import importlib
import pkgutil

import backend.handlers


class HandlerLoader:
    """Load handler modules so their routes are registered during app startup."""

    @staticmethod
    def load_handlers() -> None:
        for _, module_name, is_package in pkgutil.iter_modules(backend.handlers.__path__):
            if is_package or module_name.startswith("_") or module_name == "handler_loader":
                continue

            importlib.import_module(f"backend.handlers.{module_name}")
