"""OpenRouter API client with JSON contract, retry/repair, and failover.

Primary: DeepSeek V4 Flash
Failover: Gemini Flash
Output contract: JSON only, no prose/fences.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import settings


class PlanMeal(BaseModel):
    """A single meal in a day plan."""

    slot: str = Field(description="Meal slot: breakfast, lunch, dinner, or snack")
    name: str = Field(description="Name of the dish in Bahasa Indonesia")
    name_en: str | None = Field(default=None, description="English name of the dish")
    description: str = Field(description="Brief description of the dish")
    ingredients: list[str] = Field(description="List of ingredients")
    nutrition: dict[str, float] = Field(
        description="Nutrition info: calories, protein_g, carbs_g, fat_g, fiber_g"
    )
    prep_type: str = Field(description="buy_ready or simple_cook")
    dataset_item_ids: list[int] = Field(
        description="IDs of the food_item rows used for this meal. Budget is computed from these IDs."
    )


class DayPlan(BaseModel):
    """A complete day plan."""

    meals: list[PlanMeal]
    notes: str | None = Field(default=None, description="Health tips or notes about the plan")


class LLMConfig(BaseModel):
    """Configuration for an LLM model."""

    model: str
    base_url: str = "https://openrouter.ai/api/v1"
    max_tokens: int = 4096
    temperature: float = 0.7


# ── Model configs ──

PRIMARY_MODEL = LLMConfig(
    model=settings.llm_primary_model or "deepseek/deepseek-v4-flash",
    max_tokens=4096,
    temperature=0.7,
)

FAILOVER_MODEL = LLMConfig(
    model=settings.llm_failover_model or "gemini/gemini-2.0-flash-exp",
    max_tokens=4096,
    temperature=0.7,
)


class LLMClient:
    """Client for making LLM requests via OpenRouter with JSON contract enforcement."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.openrouter_api_key
        self.base_url = settings.openrouter_base_url
        self.http_client = httpx.AsyncClient(timeout=60.0)

    async def _call_model(
        self,
        model_config: LLMConfig,
        messages: list[dict],
        response_model: type[BaseModel] | None = None,
        max_retries: int = 2,
    ) -> dict[str, Any] | None:
        """Call a single model with retry logic.

        Args:
            model_config: The model to call.
            messages: The chat messages.
            response_model: Optional Pydantic model for response validation.
            max_retries: Number of retries on parse failure.

        Returns:
            Parsed JSON response, or None if all retries failed.
        """
        # Build system message with JSON contract
        system_msg = {
            "role": "system",
            "content": (
                "You are a nutritionist creating healthy Indonesian meal plans. "
                "You MUST respond with valid JSON only. No markdown, no fences, no prose. "
                "The response must be a valid JSON object matching the requested schema. "
                "Use the exact dataset_item_ids provided — never invent IDs. "
                "Budget is computed from IDs, not from text. "
                "All prices are based on the national base price × city price tier multiplier."
            ),
        }

        full_messages = [system_msg] + messages

        for attempt in range(max_retries + 1):
            try:
                response = await self.http_client.post(
                    f"{model_config.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": settings.app_url,
                        "X-Title": settings.app_name,
                    },
                    json={
                        "model": model_config.model,
                        "messages": full_messages,
                        "max_tokens": model_config.max_tokens,
                        "temperature": model_config.temperature,
                        "response_format": {"type": "json_object"},
                    },
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    print(
                        f"⚠️  OpenRouter error ({response.status_code}): "
                        f"{error_data.get('error', {}).get('message', response.text)}"
                    )
                    if attempt < max_retries:
                        continue
                    return None

                result = response.json()
                content = result["choices"][0]["message"]["content"]
                if content is None:
                    print("⚠️  LLM returned empty content, retrying...")
                    if attempt < max_retries:
                        continue
                    return None

                # Strip potential markdown fences
                content = self._strip_fences(content)

                # Parse JSON
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    if attempt < max_retries:
                        print(f"⚠️  JSON parse failed on attempt {attempt + 1}, retrying...")
                        # Stricter reminder
                        full_messages.append({
                            "role": "user",
                            "content": (
                                "Your previous response was not valid JSON. "
                                "Respond with ONLY valid JSON, no markdown, no fences, no extra text. "
                                "Ensure all keys and string values are properly quoted."
                            ),
                        })
                        continue
                    return None

                # Validate against response model if provided
                if response_model:
                    try:
                        response_model.model_validate(parsed)
                    except Exception as e:
                        # Try to repair common format issues
                        repaired = self._repair_plan_format(parsed)
                        if repaired is not None:
                            try:
                                response_model.model_validate(repaired)
                                parsed = repaired
                                print("⚠️  Plan format repaired successfully")
                            except Exception:
                                if attempt < max_retries:
                                    print(f"⚠️  Schema validation failed: {e}, retrying...")
                                    full_messages.append({
                                        "role": "user",
                                        "content": (
                                            f"Your response didn't match the required schema. "
                                            f"Error: {e}. Please respond with valid JSON matching the schema. "
                                            "The response must have a 'meals' array where each meal has 'slot', 'name', "
                                            "'description', 'ingredients', 'nutrition', 'prep_type', 'dataset_item_ids'. "
                                            "Do NOT use breakfast/lunch/dinner as keys."
                                        ),
                                    })
                                    continue
                        else:
                            if attempt < max_retries:
                                print(f"⚠️  Schema validation failed: {e}, retrying...")
                                full_messages.append({
                                    "role": "user",
                                    "content": (
                                        f"Your response didn't match the required schema. "
                                        f"Error: {e}. Please respond with valid JSON matching the schema. "
                                        "The response must have a 'meals' array where each meal has 'slot', 'name', "
                                        "'description', 'ingredients', 'nutrition', 'prep_type', 'dataset_item_ids'. "
                                        "Do NOT use breakfast/lunch/dinner as keys."
                                    ),
                                })
                                continue

                return parsed

            except httpx.TimeoutException:
                print(f"⚠️  Timeout on attempt {attempt + 1}")
                if attempt < max_retries:
                    continue
                return None
            except Exception as e:
                print(f"⚠️  LLM call error: {e}")
                if attempt < max_retries:
                    continue
                return None

        return None

    async def generate_plan(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel] = DayPlan,
    ) -> dict[str, Any] | None:
        """Generate a day plan using the LLM with primary → failover fallback.

        Args:
            system_prompt: The system prompt with context and constraints.
            user_prompt: The user prompt with ranked candidates and user info.
            response_model: The Pydantic model for response validation.

        Returns:
            Parsed JSON response, or None if both models failed.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Try primary model
        result = await self._call_model(PRIMARY_MODEL, messages, response_model)
        if result is not None:
            print(f"✅ Plan generated with {PRIMARY_MODEL.model}")
            return result

        # Failover to secondary model
        print(f"⚠️  Primary model failed, trying failover: {FAILOVER_MODEL.model}")
        result = await self._call_model(FAILOVER_MODEL, messages, response_model)
        if result is not None:
            print(f"✅ Plan generated with {FAILOVER_MODEL.model}")
            return result

        print("❌ Both models failed to generate a valid plan")
        return None

    async def chat_adjust(
        self,
        plan: dict[str, Any],
        message: str,
        history: list[dict] | None = None,
    ) -> dict[str, Any] | None:
        """Adjust an existing plan via chat.

        Args:
            plan: The current day plan.
            message: The user's adjustment request.
            history: Optional conversation history.

        Returns:
            Adjusted plan, or None if generation failed.
        """
        system_prompt = (
            "You are a nutritionist assistant helping refine a meal plan. "
            "The current plan is below. Adjust it based on the user's request. "
            "Respond with JSON only, matching the same schema as the current plan. "
            "Use the same dataset_item_ids when referencing the same items. "
            "Budget is computed from IDs, not from text."
        )

        messages = [{"role": "system", "content": system_prompt}]

        if history:
            for msg in history:
                messages.append(msg)

        messages.append({
            "role": "user",
            "content": (
                f"Current plan: {json.dumps(plan, indent=2)}\n\n"
                f"User request: {message}\n\n"
                "Please adjust the plan accordingly and return the updated plan as JSON."
            ),
        })

        result = await self._call_model(PRIMARY_MODEL, messages, DayPlan)
        if result is not None:
            return result

        result = await self._call_model(FAILOVER_MODEL, messages, DayPlan)
        return result

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.http_client.aclose()

    @staticmethod
    def _repair_plan_format(parsed: dict) -> dict | None:
        """Repair common LLM output format issues for plan generation.

        Handles:
        - breakfast/lunch/dinner as keys instead of a 'meals' array
        - ingredients as comma-separated string instead of list
        - dataset_item_ids as int instead of list
        - nutrition as nested dict (already correct for Pydantic)
        """
        # Step 1: Normalize to {meals: [...]} format
        if "meals" not in parsed or not isinstance(parsed["meals"], list):
            # Check if the dict has slot-named keys (breakfast, lunch, dinner, etc.)
            known_slots = {"breakfast", "lunch", "dinner", "snack", "brunch"}
            meals = []
            for key, value in parsed.items():
                if isinstance(value, dict) and key.lower() in known_slots:
                    value["slot"] = key.lower()
                    meals.append(value)
                elif isinstance(value, list) and key.lower() in known_slots:
                    for item in value:
                        if isinstance(item, dict):
                            item["slot"] = key.lower()
                            meals.append(item)

            if meals:
                parsed = {"meals": meals, "notes": parsed.get("notes")}
            else:
                return None

        # Step 2: Repair individual meal fields
        for meal in parsed.get("meals", []):
            if not isinstance(meal, dict):
                continue
            # ingredients: string → list
            if isinstance(meal.get("ingredients"), str):
                meal["ingredients"] = [
                    x.strip() for x in meal["ingredients"].split(",") if x.strip()
                ]
            # dataset_item_ids: int → list
            if isinstance(meal.get("dataset_item_ids"), (int, float)):
                meal["dataset_item_ids"] = [int(meal["dataset_item_ids"])]
            # nutrition: ensure it's a dict
            if not isinstance(meal.get("nutrition"), dict):
                meal["nutrition"] = {}
            # price_idr: ensure it's a number
            if "price_idr" not in meal:
                meal["price_idr"] = 0

        return parsed

    @staticmethod
    def _strip_fences(content: str | None) -> str:
        """Strip markdown code fences from LLM output."""
        if not content:
            return ""
        # Remove ```json ... ``` fences
        content = re.sub(r'^```(?:json)?\s*\n?', '', content, flags=re.MULTILINE)
        content = re.sub(r'\n?```\s*$', '', content, flags=re.MULTILINE)
        # Remove standalone ``` fences
        content = re.sub(r'```', '', content)
        return content.strip()

    @staticmethod
    def build_plan_prompt(
        user_info: dict,
        macro_target: dict,
        candidates: dict[str, list[dict]],
        forbidden_tags: list[str],
        recent_meals: list[str],
        already_suggested_ids: list[str] | None = None,
    ) -> tuple[str, str]:
        """Build the system and user prompts for plan generation.

        Args:
            user_info: Dict with condition, sex, city, budget info.
            macro_target: Dict with daily macro targets.
            candidates: Dict mapping slot -> list of candidate food dicts.
            forbidden_tags: List of tags that are forbidden.
            recent_meals: List of recently eaten food names.

        Returns:
            Tuple of (system_prompt, user_prompt).
        """
        system_prompt = (
            "You are a nutritionist AI creating healthy Indonesian meal plans. "
            "You MUST respond with valid JSON ONLY. No markdown, no fences, no prose. "
            "Create a 3-meal day plan (breakfast, lunch, dinner) using the provided "
            "candidate food items. Each meal must reference valid dataset_item_ids. "
            "Budget is computed from IDs, not from text.\n\n"
            "IMPORTANT RULES:\n"
            "1. Never include any food with these forbidden tags: "
            f"{', '.join(forbidden_tags) if forbidden_tags else 'none'}\n"
            "2. Vary the meals — avoid repeating the same dish across slots. "
            "Try to pick different foods for each meal slot.\n"
            "3. Respect the user's macro targets.\n"
            "4. Recent meals to avoid: "
            f"{', '.join(recent_meals) if recent_meals else 'none'}\n"
            "5. Foods already suggested today (avoid these IDs): "
            f"{', '.join(already_suggested_ids) if already_suggested_ids else 'none'}\n"
            "6. JSON format MUST be: {\"meals\": [{\"slot\": \"breakfast\", \"name\": \"...\", "
            "\"description\": \"...\", \"ingredients\": [\"item1\", \"item2\"], "
            "\"nutrition\": {\"calories\": 0, \"protein_g\": 0, \"carbs_g\": 0, \"fat_g\": 0, \"fiber_g\": 0}, "
            "\"prep_type\": \"buy_ready\", \"dataset_item_ids\": [1]}], "
            "\"notes\": \"...\"}\n"
            "7. ingredients MUST be a JSON array of strings, NOT a comma-separated string.\n"
            "8. dataset_item_ids MUST be a JSON array of integers, NOT a single integer.\n"
            "9. Use the candidate items provided — never invent food items.\n"
            "10. The nutrition field should approximate the item's known values."
        )

        user_prompt = (
            f"User info: {json.dumps(user_info, indent=2)}\n\n"
            f"Daily macro targets: {json.dumps(macro_target, indent=2)}\n\n"
            f"Candidate foods per slot: {json.dumps(candidates, indent=2, default=str)}\n\n"
            "Create a healthy, varied day plan using these candidates."
        )

        return system_prompt, user_prompt