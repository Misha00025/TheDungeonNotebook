
from app import AUTH_SERVICE_URL, POLICY_SERVICE_URL, USERS_SERVICE_URL, CAMPAIGN_SERVICE_URL, NOTES_SERVICE_URL
from app.services.auth_service import AuthService
from app.services.policy_service import PolicyService
from app.services.users_service import UsersService
from app.services.campaign_service import CampaignService


def auth(headers) -> AuthService:
    return AuthService(AUTH_SERVICE_URL, headers)


def polices(headers) -> PolicyService:
    return PolicyService(POLICY_SERVICE_URL, headers)


def users(headers, user_id = None) -> UsersService:
    return UsersService(USERS_SERVICE_URL, headers, user_id)


def groups(headers, group_id = None) -> CampaignService:
    return CampaignService(CAMPAIGN_SERVICE_URL, NOTES_SERVICE_URL, headers, group_id)