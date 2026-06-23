"""Priority-based command scheduler.

우선순위 (높은 순):
1. safety_queue
2. connection_queue
3. control_queue
4. polling_queue
5. background_queue
"""

from __future__ import annotations

from queue import Empty, Queue
from typing import Optional

from backend.schemas.command import CommandQueueType, DeviceCommand


class CommandScheduler:
    """5-priority queue 스케줄러."""

    def __init__(self) -> None:
        self.safety: Queue[DeviceCommand] = Queue()
        self.connection: Queue[DeviceCommand] = Queue()
        self.control: Queue[DeviceCommand] = Queue()
        self.polling: Queue[DeviceCommand] = Queue()
        self.background: Queue[DeviceCommand] = Queue()

        self._by_type: dict[CommandQueueType, Queue[DeviceCommand]] = {
            CommandQueueType.SAFETY: self.safety,
            CommandQueueType.CONNECTION: self.connection,
            CommandQueueType.CONTROL: self.control,
            CommandQueueType.POLLING: self.polling,
            CommandQueueType.BACKGROUND: self.background,
        }
        self._priority_order = [
            self.safety,
            self.connection,
            self.control,
            self.polling,
            self.background,
        ]

    def enqueue(self, command: DeviceCommand) -> None:
        self._by_type[command.queue_type].put(command)

    def dequeue(self) -> Optional[DeviceCommand]:
        """우선순위 순으로 큐를 탐색해 첫 번째 command를 반환. 없으면 None."""
        for q in self._priority_order:
            try:
                return q.get_nowait()
            except Empty:
                pass
        return None

    def is_empty(self) -> bool:
        return all(q.empty() for q in self._priority_order)

    def polling_pending_count(self) -> int:
        return self.polling.qsize()
