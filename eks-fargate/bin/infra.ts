#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ProjectStack } from '../lib/infra-stack';

const app = new cdk.App();
new ProjectStack(app, 'InfraStack');
