"""TutorOS memory layer backed by EverOS Cloud.

Follows the AI Tutor cookbook pattern from https://docs.evermind.ai/llms-full.txt
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from everos_cloud import EverOS


def tutee_user_id(tutee_id: str) -> str:
    """Namespace Leigh NHS tutees inside EverOS."""
    slug = tutee_id.strip().lower().replace(" ", "-")
    return f"leigh-nhs-tutee-{slug}"


@dataclass
class TutorMemory:
    """Persistent tutoring memory for a single tutee (EverOS user_id)."""

    client: EverOS

    @classmethod
    def from_env(cls) -> TutorMemory:
        return cls(client=EverOS())

    def record_session(
        self,
        *,
        tutee_id: str,
        session_id: str,
        subject: str,
        topic: str,
        tutor_reflection: str,
        understanding_score: int | None = None,
        duration_minutes: int | None = None,
        location: str | None = None,
    ) -> dict[str, Any]:
        """Store a completed tutoring session and flush extraction."""
        user_id = tutee_user_id(tutee_id)
        now_ms = int(time.time() * 1000)

        score_line = ""
        if understanding_score is not None:
            score_line = f" Understanding score: {understanding_score}/5."

        meta = []
        if duration_minutes is not None:
            meta.append(f"Duration: {duration_minutes} minutes.")
        if location:
            meta.append(f"Location: {location}.")

        user_content = (
            f"Tutoring session on {subject} — topic: {topic}. "
            f"Tutor reflection: {tutor_reflection}"
            + (" " + " ".join(meta) if meta else "")
        )
        assistant_content = (
            f"Recorded {subject} tutoring on {topic} for future prep."
            + score_line
            + (" Needs follow-up." if understanding_score is not None and understanding_score < 3 else "")
        )

        add_response = self.client.v1.memories.add(
            user_id=user_id,
            session_id=session_id,
            messages=[
                {"role": "user", "timestamp": now_ms, "content": user_content},
                {"role": "assistant", "timestamp": now_ms + 1000, "content": assistant_content},
            ],
        )

        flush_response = self.client.v1.memories.flush(user_id=user_id, session_id=session_id)

        return {
            "user_id": user_id,
            "session_id": session_id,
            "add_status": getattr(add_response.data, "status", None),
            "flush_status": getattr(flush_response.data, "status", None),
        }

    def get_learning_context(self, tutee_id: str, topic: str) -> dict[str, Any]:
        """Retrieve profile + episodic context for session prep."""
        user_id = tutee_user_id(tutee_id)
        memories = self.client.v1.memories

        profile = memories.search(
            filters={"user_id": user_id},
            query=f"learning style preferences {topic}",
            method="hybrid",
            memory_types=["profile"],
            top_k=5,
        )
        progress = memories.search(
            filters={"user_id": user_id},
            query=f"{topic} tutoring struggled succeeded approach",
            method="hybrid",
            memory_types=["episodic_memory"],
            top_k=5,
        )

        episodes = getattr(progress.data, "episodes", None) or []
        profiles = getattr(profile.data, "profiles", None) or []

        return {
            "user_id": user_id,
            "topic": topic,
            "episodes": [
                {
                    "summary": getattr(ep, "summary", None),
                    "episode": getattr(ep, "episode", None),
                    "subject": getattr(ep, "subject", None),
                    "timestamp": getattr(ep, "timestamp", None),
                }
                for ep in episodes
            ],
            "profiles": [
                {
                    "profile_data": getattr(p, "profile_data", None),
                    "scenario": getattr(p, "scenario", None),
                }
                for p in profiles
            ],
        }
