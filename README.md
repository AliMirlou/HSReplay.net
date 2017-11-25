# [HSReplay.net](https://hsreplay.net)

A website to upload and share your Hearthstone games.


## Technology overview

The full backend stack is written in Python 3.

* Web framework: [Django](https://www.djangoproject.com/)
* Replay viewer: [Joust](https://github.com/HearthSim/joust/)
* HSReplay implementation: [HSReplay](https://github.com/HearthSim/hsreplay)
* Hearthstone library: [python-hearthstone](https://github.com/HearthSim/python-hearthstone)


### Django libraries

* API: [Django REST Framework](http://www.django-rest-framework.org/)
* Authentication: [Django Allauth](https://github.com/pennersr/django-allauth)
* OAuth2: [Django OAuth Toolkit](https://github.com/evonove/django-oauth-toolkit)
* Storage backends: [Django-Storages](https://github.com/jschneier/django-storages)
* Short IDs: [ShortUUID](https://github.com/stochastic-technologies/shortuuid)
* Stripe: [dj-stripe](https://github.com/dj-stripe/dj-stripe)
* PayPal: [dj-paypal](https://github.com/HearthSim/dj-paypal)


### Production stack

* Accounts: [Blizzard API](https://dev.battle.net/)
* Web server: [Caddy](https://caddyserver.com/)
* App server: [uWSGI](https://uwsgi-docs.readthedocs.io/en/latest/)
* Database: [PostgreSQL (RDS)](https://aws.amazon.com/rds/postgresql/)
* OLAP: [AWS Redshift](https://aws.amazon.com/redshift/)
* Hosting: [Amazon Web Services](https://aws.amazon.com/)
* Metrics: [InfluxDB](https://influxdata.com/)
* Exception tracking: [Sentry](https://sentry.io/)
* CI: [Jenkins](https://jenkins.io/)
* Payments: [Stripe](https://stripe.com/)

Replays are processed on [Amazon Lambda](https://aws.amazon.com/lambda/details/)
using the Python 3.6 runtime.


## Installation

Prerequisites:

- [Vagrant](https://vagrantup.com) must be installed
- Virtualbox must be installed in order for the default provider to work

Use the [HearthSim Vagrant Box](https://github.com/HearthSim/hearthsim-vagrant)
to run the server locally.

The Django server will then be available on `localhost:8000`.
The API is available at `/api/v1/` and is browsable using the DRF interface.


## License

Copyright © HearthSim - All Rights Reserved
