# -*- coding: utf-8 -*-
# Generated by Django 1.11.4 on 2017-08-28 00:17
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('decks', '0008_clustersnapshot_rules'),
    ]

    operations = [
        migrations.AddField(
            model_name='clustersnapshotmember',
            name='card_list',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='clustersnapshotmember',
            name='shortid',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
