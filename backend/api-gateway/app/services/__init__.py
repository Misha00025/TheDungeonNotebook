
from app import AUTH_SERVICE_URL, POLICY_SERVICE_URL, USERS_SERVICE_URL, CAMPAIGN_SERVICE_URL
from app.services.auth_service import AuthService
from app.services.policy_service import PolicyService
from app.services.users_service import UsersService
from app.services.campaign_service import CampaignService


def auth() -> AuthService:
    return AuthService(AUTH_SERVICE_URL)


def polices() -> PolicyService:
    return PolicyService(POLICY_SERVICE_URL)


def users() -> UsersService:
    return UsersService(USERS_SERVICE_URL)


def groups() -> CampaignService:
    return CampaignService(CAMPAIGN_SERVICE_URL)