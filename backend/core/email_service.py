from django.core.mail import send_mail
from django.conf import settings


def send_verification_email(to_email, code):
    send_mail(
        subject="MediFlow Login Verification Code",
        message=f"Your MediFlow verification code is {code}. This code expires in 10 minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
        fail_silently=False,
    )