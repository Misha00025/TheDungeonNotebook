
import os

USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL", "http://users-service:8080")
CAMPAIGN_SERVICE_URL = os.environ.get("CAMPAIGN_SERVICE_URL", "http://campaign-service:8080")

from app.services.policy_service import PolicyService
from app.services.users_service import UsersService
from app.services.campaign_service import CampaignService


def polices(headers) -> PolicyService:
    return PolicyService(CAMPAIGN_SERVICE_URL, headers)


def users(headers, user_id = None) -> UsersService:
    return UsersService(USERS_SERVICE_URL, headers, user_id)


def groups(headers, group_id = None) -> CampaignService:
    return CampaignService(CAMPAIGN_SERVICE_URL, CAMPAIGN_SERVICE_URL, headers, group_id)
