from dataclasses import dataclass
from time import monotonic


@dataclass
class BackendStateManager:
    started_at: float

    @classmethod
    def create(cls) -> "BackendStateManager":
        return cls(started_at=monotonic())

    def uptime_seconds(self) -> float:
        return monotonic() - self.started_at
