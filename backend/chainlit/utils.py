import datetime
import functools
import importlib
import inspect
import os
import traceback
from asyncio import CancelledError
from typing import Callable

import click
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from packaging import version
from starlette.middleware.base import BaseHTTPMiddleware

from chainlit.auth import ensure_jwt_secret
from chainlit.context import context
from chainlit.logger import logger
from chainlit.message import ErrorMessage


def wrap_user_function(user_function: Callable, with_task=False) -> Callable:
    """
    Wraps a user-defined function to accept arguments as a dictionary.

    Args:
        user_function (Callable): The user-defined function to wrap.

    Returns:
        Callable: The wrapped function.
    """

    @functools.wraps(user_function)
    async def wrapper(*args):
        # Get the parameter names of the user-defined function
        user_function_params = list(inspect.signature(user_function).parameters.keys())

        # Create a dictionary of parameter names and their corresponding values from *args
        params_values = {
            param_name: arg for param_name, arg in zip(user_function_params, args)
        }

        if with_task:
            await context.emitter.task_start()

        try:
            # Call the user-defined function with the arguments
            if inspect.iscoroutinefunction(user_function):
                return await user_function(**params_values)
            else:
                return user_function(**params_values)
        except CancelledError:
            pass
        except Exception:
            logger.error(traceback.format_exc())
            if with_task:
                await ErrorMessage(
                    content=generate_helpdesk_message(),
                    author="B.R.A.I.N",
                ).send()
            else:
                await context.emitter.send_toast(generate_helpdesk_message(), "error")
        finally:
            if with_task:
                await context.emitter.task_end()

    return wrapper


def make_module_getattr(registry):
    """Leverage PEP 562 to make imports lazy in an __init__.py

    The registry must be a dictionary with the items to import as keys and the
    modules they belong to as a value.
    """

    def __getattr__(name):
        module_path = registry[name]
        module = importlib.import_module(module_path, __package__)
        return getattr(module, name)

    return __getattr__


def check_module_version(name, required_version):
    """
    Check the version of a module.

    Args:
        name (str): A module name.
        version (str): Minimum version.

    Returns:
        (bool): Return True if the module is installed and the version
            match the minimum required version.
    """
    try:
        module = importlib.import_module(name)
    except ModuleNotFoundError:
        return False
    return version.parse(module.__version__) >= version.parse(required_version)


def check_file(target: str):
    # Define accepted file extensions for Chainlit
    ACCEPTED_FILE_EXTENSIONS = ("py", "py3")

    _, extension = os.path.splitext(target)

    # Check file extension
    if extension[1:] not in ACCEPTED_FILE_EXTENSIONS:
        if extension[1:] == "":
            raise click.BadArgumentUsage(
                "Chainlit requires raw Python (.py) files, but the provided file has no extension."
            )
        else:
            raise click.BadArgumentUsage(
                f"Chainlit requires raw Python (.py) files, not {extension}."
            )

    if not os.path.exists(target):
        raise click.BadParameter(f"File does not exist: {target}")


def mount_chainlit(app: FastAPI, target: str, path="/chainlit"):
    from chainlit.config import config, load_module
    from chainlit.server import app as chainlit_app

    config.run.debug = os.environ.get("CHAINLIT_DEBUG", False)
    os.environ["CHAINLIT_ROOT_PATH"] = path

    api_full_path = path

    if app.root_path:
        parent_root_path = app.root_path.rstrip("/")
        api_full_path = parent_root_path + path
        os.environ["CHAINLIT_PARENT_ROOT_PATH"] = parent_root_path

    check_file(target)
    # Load the module provided by the user
    config.run.module_name = target
    load_module(config.run.module_name)

    ensure_jwt_secret()

    class ChainlitMiddleware(BaseHTTPMiddleware):
        """Middleware to handle path routing for submounted Chainlit applications.

        When Chainlit is submounted within a larger FastAPI application, its default route
        `@router.get("/{full_path:path}")` can conflict with the main app's routing. This
        middleware ensures requests are only forwarded to Chainlit if they match the
        designated subpath, preventing routing collisions.

        If a request's path doesn't start with the configured subpath, the middleware
        returns a 404 response instead of forwarding to Chainlit's default route.
        """

        async def dispatch(self, request: Request, call_next):
            if not request.url.path.startswith(api_full_path):
                return JSONResponse(status_code=404, content={"detail": "Not found"})

            return await call_next(request)

    chainlit_app.add_middleware(ChainlitMiddleware)

    app.mount(path, chainlit_app)


def generate_helpdesk_message() -> str:
    HELPDESK_URL = "https://odoo.infomineo.com/web#menu_id=262&cids=18&action=379&active_id=51&model=helpdesk.ticket&view_type=form"
    timestamp = datetime.datetime.now().strftime("%B %d, %Y at %I:%M:%S %p")
    helpdesk_message = (
        f"Oops! Something went wrong.\n\n"
        f"Please report this issue to our support team by opening a ticket at:\n"
        f"{HELPDESK_URL}\n\n"
        f"**To help us investigate, please include the following in your ticket:**\n"
        f"- 📝 A brief description of what you were trying to do before the error occurred.\n"
        f"- 🕒 The timestamp of the issue: **{timestamp}**.\n\n"
        f"Thank you for your patience!"
    )
    return helpdesk_message
