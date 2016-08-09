# -*- coding: utf-8 -*-
# Generated by Django 1.10 on 2016-08-09 19:00
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('games', '0011_auto_20160728_2036'),
    ]

    operations = [
        migrations.AddField(
            model_name='globalgameplayer',
            name='cardback_id',
            field=models.IntegerField(blank=True, null=True, verbose_name='Cardback ID'),
        ),
        migrations.AddField(
            model_name='globalgameplayer',
            name='deck_id',
            field=models.IntegerField(blank=True, null=True, verbose_name='Deck ID'),
        ),
    ]
