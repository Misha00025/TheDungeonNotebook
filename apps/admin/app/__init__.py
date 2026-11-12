from flask import Flask


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")

    app.config.from_object("app.config.Config")

    app.config["JWT_SECRET"] = app.config["ADMIN_JWT_SECRET"]

    from app.routes import register_routes
    register_routes(app)

    from app.middleware import setup_middleware
    setup_middleware(app)

    return app
