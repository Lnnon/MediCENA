from rest_framework.exceptions import APIException


class VerificationDeliveryError(APIException):
    status_code = 503
    default_detail = "Verification email is unavailable. Please try again later."
    default_code = "verification_delivery_failed"
