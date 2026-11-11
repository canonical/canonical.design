import flask
import functools
from canonicalwebteam.flask_base.env import get_flask_env
from authlib.integrations.flask_client import OAuth


def _safe_next(url: str | None) -> str:
    """Only allow local paths to prevent open redirects."""
    if url and url.startswith("/") and not url.startswith(("//", "/\\")):
        return url
    return "/"


def init_sso(app: flask.Flask) -> None:
    """Initialize SSO for the Flask app."""
    oauth = OAuth(app)
    app.config["SSO_CLIENT_ID"] = get_flask_env("SSO_CLIENT_ID")
    app.config["SSO_CLIENT_SECRET"] = get_flask_env("SSO_CLIENT_SECRET")
    app.config["SSO_CLIENT_URI"] = get_flask_env("SSO_CLIENT_URI")

    oauth.register(
        "canonical",
        client_id=app.config["SSO_CLIENT_ID"],
        client_secret=app.config["SSO_CLIENT_SECRET"],
        server_metadata_url=app.config["SSO_CLIENT_URI"],
        client_kwargs={
            "token_endpoint_auth_method": "client_secret_post",
            "scope": "openid profile email",
        },
    )

    @app.route("/login")
    def login():
        next_url = _safe_next(flask.request.args.get("next"))
        if get_flask_env("DISABLE_SSO") == "true" or "openid" in flask.session:
            return flask.redirect(next_url)

        flask.session["next"] = next_url
        redirect_uri = flask.url_for("oauth_callback", _external=True)
        return oauth.canonical.authorize_redirect(redirect_uri)

    @app.route("/auth/callback")
    def oauth_callback():
        token = oauth.canonical.authorize_access_token()
        user_email = token["userinfo"]["email"]
        if not user_email.endswith("@canonical.com"):
            flask.abort(403, description="Canonical employees only")

        flask.session["openid"] = {
            "identity_url": token["userinfo"]["iss"],
            "email": user_email,
            "fullname": token["userinfo"]["name"],
        }

        return flask.redirect(_safe_next(flask.session.pop("next", None)))

    @app.route("/logout")
    def logout():
        if "openid" in flask.session:
            flask.session.pop("openid")

        return flask.redirect("/")


def login_required(func):
    """
    Decorator that checks if a user is logged in, and redirects
    to login page if not.
    """

    @functools.wraps(func)
    def is_user_logged_in(*args, **kwargs):
        if "openid" in flask.session:
            return func(*args, **kwargs)

        # Return if the sso is explicitly disabled.
        # Useful for non interactive testing.
        if get_flask_env("DISABLE_SSO") == "true":
            flask.current_app.logger.info(
                "SSO Disabled. Session has no openid."
            )
            return func(*args, **kwargs)

        return flask.redirect("/login?next=" + flask.request.path)

    return is_user_logged_in
