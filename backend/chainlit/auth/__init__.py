import os

from fastapi import Depends, HTTPException, Request, Response

from chainlit.config import config
from chainlit.data import get_data_layer
from chainlit.logger import logger
from chainlit.oauth_providers import get_configured_oauth_providers

from .cookie import (
    OAuth2PasswordBearerWithCookie,
    clear_auth_cookie,
    delete_client_side_session_cookie,
    get_client_side_session_from_cookies,
    get_token_from_cookies,
    set_auth_cookie,
    set_client_side_session_cookie,
)
from .jwt import (
    create_jwt,
    decode_client_side_session,
    decode_jwt,
    encode_client_side_session,
    get_jwt_secret,
)

reuseable_oauth = OAuth2PasswordBearerWithCookie(tokenUrl="/login", auto_error=False)


def ensure_jwt_secret():
    if require_login() and get_jwt_secret() is None:
        raise ValueError(
            "You must provide a JWT secret in the environment to use authentication. Run `chainlit create-secret` to generate one."
        )


def is_oauth_enabled():
    return config.code.oauth_callback and len(get_configured_oauth_providers()) > 0


def require_login():
    return (
        bool(os.environ.get("CHAINLIT_CUSTOM_AUTH"))
        or config.code.password_auth_callback is not None
        or config.code.header_auth_callback is not None
        or is_oauth_enabled()
    )


def get_configuration():
    return {
        "requireLogin": require_login(),
        "passwordAuth": config.code.password_auth_callback is not None,
        "headerAuth": config.code.header_auth_callback is not None,
        "oauthProviders": (
            get_configured_oauth_providers() if is_oauth_enabled() else []
        ),
        "default_theme": config.ui.default_theme,
        "ui": {
            "login_page_image": config.ui.login_page_image,
            "login_page_image_filter": config.ui.login_page_image_filter,
            "login_page_image_dark_filter": config.ui.login_page_image_dark_filter,
        },
    }


async def authenticate_user(token: str = Depends(reuseable_oauth)):
    try:
        user = decode_jwt(token)
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={
                "Clear-Site-Data": '"cache", "cookies", "storage"'
            },  # TODO: fixes a bug where the browser caches all responses, should be removed safely by August 1st, 2025 as the max-age of the cached responses is 1 month
        ) from e

    if data_layer := get_data_layer():
        # Get or create persistent user if we've a data layer available.
        try:
            persisted_user = await data_layer.get_user(user.identifier)
            if persisted_user is None:
                persisted_user = await data_layer.create_user(user)
                assert persisted_user
        except Exception as e:
            logger.exception("Unable to get persisted_user from data layer: %s", e)
            return user

        if user and user.display_name:
            # Copy ephemeral display_name from authenticated user to persistent user.
            persisted_user.display_name = user.display_name

        return persisted_user

    return user


async def get_current_user(token: str = Depends(reuseable_oauth)):
    if not require_login():
        return None

    return await authenticate_user(token)


def update_client_side_session(
    request: Request, response: Response, data: dict[str, object]
):
    client_side_session = get_client_side_session(request) or {}
    client_side_session.update(data)
    set_client_side_session_cookie(
        response, encode_client_side_session(client_side_session)
    )


def get_client_side_session(request: Request):
    encoded_client_side_session = get_client_side_session_from_cookies(request.cookies)
    return encoded_client_side_session and decode_client_side_session(
        encoded_client_side_session
    )


def clear_client_side_session(response: Response):
    delete_client_side_session_cookie(response)


__all__ = [
    "clear_auth_cookie",
    "clear_client_side_session",
    "create_jwt",
    "get_client_side_session",
    "get_configuration",
    "get_current_user",
    "get_token_from_cookies",
    "set_auth_cookie",
    "update_client_side_session",
]
