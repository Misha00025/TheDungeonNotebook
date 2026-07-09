from app.routes.auth import auth_bp
from app.routes.dashboard import dashboard_bp
from app.routes.users import users_bp
from app.routes.groups import groups_bp
from app.routes.content import content_bp


def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix="/admin")
    app.register_blueprint(dashboard_bp, url_prefix="/admin")
    app.register_blueprint(users_bp, url_prefix="/admin")
    app.register_blueprint(groups_bp, url_prefix="/admin")
    app.register_blueprint(content_bp, url_prefix="/admin")

    @app.route("/")
    def index():
        from flask import redirect, url_for
        return redirect(url_for("dashboard.index"))
