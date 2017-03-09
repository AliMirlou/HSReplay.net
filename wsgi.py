"""
WSGI config for HSReplay.net

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.9/howto/deployment/wsgi/
"""
# flake8: noqa

import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hsreplaynet.settings")
import sys; sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from django.core.wsgi import get_wsgi_application


application = get_wsgi_application()
