import os


class Config:
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
    ADMIN_JWT_SECRET = os.environ.get("ADMIN_JWT_SECRET", "dev-secret")

    AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8080")
    USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL", "http://users-service:8080")
    CAMPAIGN_SERVICE_URL = os.environ.get("CAMPAIGN_SERVICE_URL", "http://campaign-service:8080")

    PASSWORD_RESET_LINK_TEMPLATE = os.environ.get("PASSWORD_RESET_LINK_TEMPLATE", "")
