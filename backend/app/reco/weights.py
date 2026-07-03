"""Preference scoring weights — single tunable config.

All weights live here with sane defaults, unit-tested, and documented.
Preference weights (w_like, w_cuisine, w_spice, w_prep) collectively outrank
w_nutri so user taste dominates among nutritionally-acceptable options.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoringWeights:
    """Tunable weights for the preference scoring function.

    Preference weights collectively outrank w_nutri so that, among
    nutritionally-acceptable options, the user's taste dominates the pick.
    """

    # ── Preference weights (collectively dominant) ──
    w_like: float = 3.0       # Bonus per liked ingredient/cuisine/protein hit
    w_soft: float = 2.0       # Penalty per soft-disliked ingredient match
    w_cuisine: float = 2.5    # Bonus for preferred-cuisine match
    w_spice: float = 1.5      # Fit to spice tolerance (0 = perfect, penalty = gap)
    w_prep: float = 1.0       # Match to prep preference (buy_ready vs simple_cook)

    # ── Nutrition weight (lower than preference weights) ──
    w_nutri: float = 1.0      # How well it advances the day's macro targets

    # ── Variety / non-repetition ──
    w_repeat: float = 5.0     # Penalty per recent serving (tuned so even 1 recent
                              # serving of a top-pick can be overcome by preference)

    # ── Budget pressure ──
    w_budget: float = 0.5     # Nudges cheaper when near budget ceiling

    # ── Recency window ──
    recency_window_days: int = 7  # Default non-repetition window

    # ── Spice tolerance scoring ──
    # spice_tolerance: 0-5 scale from user profile
    # food_item spice level: 0-5
    spice_perfect_match_bonus: float = 1.5  # Extra bonus for exact match
    spice_max_penalty: float = 2.0  # Max penalty for max gap (5 levels apart)


# Global instance with default weights
DEFAULT_WEIGHTS = ScoringWeights()