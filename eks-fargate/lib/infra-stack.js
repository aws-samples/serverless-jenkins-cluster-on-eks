"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectStack = void 0;
const cdk = require("@aws-cdk/core");
const ec2 = require("@aws-cdk/aws-ec2");
const ecr = require("@aws-cdk/aws-ecr");
const eks = require("@aws-cdk/aws-eks");
const iam = require("@aws-cdk/aws-iam");
const codebuild = require("@aws-cdk/aws-codebuild");
const codecommit = require("@aws-cdk/aws-codecommit");
const targets = require("@aws-cdk/aws-events-targets");
const ProjectName = "cmr-business-serv-customer-payments-poc";
class ProjectStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const repository = codecommit.Repository.fromRepositoryName(this, `${ProjectName}-repo`, ProjectName);
        const ecrRepo = new ecr.Repository(this, `${ProjectName}`, {
            repositoryName: `${ProjectName}`,
        });
        const baseVpc = new ec2.Vpc(this, `${ProjectName}-vpc`, {
            maxAzs: 3,
        });
        const clusterAdmin = new iam.Role(this, "AdminRole", {
            assumedBy: new iam.AccountRootPrincipal(),
        });
        const eksCluster = new eks.FargateCluster(this, `${ProjectName}-eks`, {
            vpc: baseVpc,
            version: eks.KubernetesVersion.V1_19,
            mastersRole: clusterAdmin,
        });
        const ns = eksCluster.addManifest(`${ProjectName}-ns`, {
            apiVersion: "v1",
            kind: "Namespace",
            metadata: {
                name: ProjectName,
            },
        });
        const podRole = new iam.Role(this, `${ProjectName}-pod-role`, {
            assumedBy: new iam.ServicePrincipal("eks-fargate-pods.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSFargatePodExecutionRolePolicy"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
            ],
        });
        podRole.addToPolicy(new iam.PolicyStatement({
            actions: ["sdkmetrics:*"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        podRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        eksCluster.addFargateProfile(`${ProjectName}-profile`, {
            selectors: [{ namespace: ProjectName }],
            podExecutionRole: podRole,
        });
        const serviceAccount = eksCluster.addServiceAccount("ServiceAccount", {
            name: "alb-ingress-controller",
            namespace: "kube-system",
        });
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "acm:DescribeCertificate",
                "acm:ListCertificates",
                "acm:GetCertificate",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CreateSecurityGroup",
                "ec2:CreateTags",
                "ec2:DeleteTags",
                "ec2:DeleteSecurityGroup",
                "ec2:DescribeAccountAttributes",
                "ec2:DescribeAddresses",
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeInternetGateways",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeTags",
                "ec2:DescribeVpcs",
                "ec2:ModifyInstanceAttribute",
                "ec2:ModifyNetworkInterfaceAttribute",
                "ec2:RevokeSecurityGroupIngress",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "elasticloadbalancing:AddListenerCertificates",
                "elasticloadbalancing:AddTags",
                "elasticloadbalancing:CreateListener",
                "elasticloadbalancing:CreateLoadBalancer",
                "elasticloadbalancing:CreateRule",
                "elasticloadbalancing:CreateTargetGroup",
                "elasticloadbalancing:DeleteListener",
                "elasticloadbalancing:DeleteLoadBalancer",
                "elasticloadbalancing:DeleteRule",
                "elasticloadbalancing:DeleteTargetGroup",
                "elasticloadbalancing:DeregisterTargets",
                "elasticloadbalancing:DescribeListenerCertificates",
                "elasticloadbalancing:DescribeListeners",
                "elasticloadbalancing:DescribeLoadBalancers",
                "elasticloadbalancing:DescribeLoadBalancerAttributes",
                "elasticloadbalancing:DescribeRules",
                "elasticloadbalancing:DescribeSSLPolicies",
                "elasticloadbalancing:DescribeTags",
                "elasticloadbalancing:DescribeTargetGroups",
                "elasticloadbalancing:DescribeTargetGroupAttributes",
                "elasticloadbalancing:DescribeTargetHealth",
                "elasticloadbalancing:ModifyListener",
                "elasticloadbalancing:ModifyLoadBalancerAttributes",
                "elasticloadbalancing:ModifyRule",
                "elasticloadbalancing:ModifyTargetGroup",
                "elasticloadbalancing:ModifyTargetGroupAttributes",
                "elasticloadbalancing:RegisterTargets",
                "elasticloadbalancing:RemoveListenerCertificates",
                "elasticloadbalancing:RemoveTags",
                "elasticloadbalancing:SetIpAddressType",
                "elasticloadbalancing:SetSecurityGroups",
                "elasticloadbalancing:SetSubnets",
                "elasticloadbalancing:SetWebAcl",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "iam:CreateServiceLinkedRole",
                "iam:GetServerCertificate",
                "iam:ListServerCertificates",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:DescribeUserPoolClient"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "waf-regional:GetWebACLForResource",
                "waf-regional:GetWebACL",
                "waf-regional:AssociateWebACL",
                "waf-regional:DisassociateWebACL",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: ["tag:GetResources", "tag:TagResources"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: ["waf:GetWebACL"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "wafv2:GetWebACL",
                "wafv2:GetWebACLForResource",
                "wafv2:AssociateWebACL",
                "wafv2:DisassociateWebACL",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        serviceAccount.addToPolicy(new iam.PolicyStatement({
            actions: [
                "shield:DescribeProtection",
                "shield:GetSubscriptionState",
                "shield:DeleteProtection",
                "shield:CreateProtection",
                "shield:DescribeSubscription",
                "shield:ListProtections",
            ],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        }));
        eksCluster
            .addManifest(`${ProjectName}-cluster-role`, {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRole",
            metadata: {
                labels: {
                    "app.kubernetes.io/name": "alb-ingress-controller",
                },
                name: "alb-ingress-controller",
            },
            rules: [
                {
                    apiGroups: ["", "extensions"],
                    resources: [
                        "configmaps",
                        "endpoints",
                        "events",
                        "ingresses",
                        "ingresses/status",
                        "services",
                    ],
                    verbs: ["create", "get", "list", "update", "watch", "patch"],
                },
                {
                    apiGroups: ["", "extensions"],
                    resources: ["nodes", "pods", "secrets", "services", "namespaces"],
                    verbs: ["get", "list", "watch"],
                },
            ],
        })
            .node.addDependency(serviceAccount);
        eksCluster
            .addManifest(`${ProjectName}-cluster-binding`, {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRoleBinding",
            metadata: {
                labels: {
                    "app.kubernetes.io/name": "alb-ingress-controller",
                },
                name: "alb-ingress-controller",
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "alb-ingress-controller",
            },
            subjects: [
                {
                    kind: "ServiceAccount",
                    name: "alb-ingress-controller",
                    namespace: "kube-system",
                },
            ],
        })
            .node.addDependency(serviceAccount);
        const albIngress = eksCluster.addManifest(`${ProjectName}-alb-ingress`, {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                labels: {
                    "app.kubernetes.io/name": "alb-ingress-controller",
                },
                name: "alb-ingress-controller",
                namespace: "kube-system",
            },
            spec: {
                selector: {
                    matchLabels: {
                        "app.kubernetes.io/name": "alb-ingress-controller",
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            "app.kubernetes.io/name": "alb-ingress-controller",
                        },
                    },
                    spec: {
                        containers: [
                            {
                                name: "alb-ingress-controller",
                                args: [
                                    "--ingress-class=alb",
                                    `--cluster-name=${eksCluster.clusterName}`,
                                    `--aws-vpc-id=${baseVpc.vpcId}`,
                                    `--aws-region=${this.region}`,
                                ],
                                image: "docker.io/amazon/aws-alb-ingress-controller:v1.1.8",
                            },
                        ],
                        serviceAccountName: "alb-ingress-controller",
                    },
                },
            },
        });
        albIngress.node.addDependency(serviceAccount);
        const cloudWatchAgentConfig = eksCluster.addManifest("cwagentconfig-sidecar", {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
                name: "cwagentconfig-sidecar",
                namespace: ProjectName,
            },
            data: {
                "cwagentconfig.json": '{\n  "agent": {\n    "omit_hostname": true, "region": "us-east-1"\n  },\n  "metrics": {\n    "metrics_collected": {\n      "statsd": {\n        "service_address":":8125"\n      }\n    }\n  },\n  "logs": {\n    "metrics_collected": {\n      "emf": {}\n    }\n  },\n  "csm": {\n    "service_addresses": ["udp4://127.0.0.1:31000", "udp6://[::1]:31000"],\n    "memory_limit_in_mb": 20\n  }\n}\n',
            },
        });
        cloudWatchAgentConfig.node.addDependency(ns);
        eksCluster
            .addManifest(`${ProjectName}-deployment`, {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                name: ProjectName,
                namespace: ProjectName,
            },
            spec: {
                selector: {
                    matchLabels: {
                        app: ProjectName,
                    },
                },
                replicas: 3,
                template: {
                    metadata: {
                        labels: {
                            app: ProjectName,
                        },
                    },
                    spec: {
                        containers: [
                            {
                                image: `${ecrRepo.repositoryUri}:latest`,
                                imagePullPolicy: "Always",
                                name: ProjectName,
                                ports: [
                                    {
                                        containerPort: 8080,
                                    },
                                ],
                                env: [
                                    { name: "AWS_CSM_ENABLED", value: "true" },
                                    { name: "AWS_CSM_PORT", value: "31000" },
                                    { name: "AWS_CSM_HOST", value: "127.0.0.1" },
                                ],
                            },
                            {
                                name: "cloudwatch-agent",
                                image: "amazon/cloudwatch-agent:latest",
                                imagePullPolicy: "Always",
                                env: [
                                    {
                                        name: "POD_NAME",
                                        valueFrom: {
                                            fieldRef: {
                                                fieldPath: "metadata.name",
                                            },
                                        },
                                    },
                                ],
                                resources: {
                                    limits: {
                                        cpu: "100m",
                                        memory: "100Mi",
                                    },
                                    requests: {
                                        cpu: "32m",
                                        memory: "24Mi",
                                    },
                                },
                                volumeMounts: [
                                    {
                                        name: "cwagentconfig",
                                        mountPath: "/etc/cwagentconfig",
                                    },
                                ],
                            },
                        ],
                        volumes: [
                            {
                                name: "cwagentconfig",
                                configMap: {
                                    name: "cwagentconfig-sidecar",
                                },
                            },
                        ],
                    },
                },
            },
        })
            .node.addDependency(cloudWatchAgentConfig);
        const service = eksCluster.addManifest(`${ProjectName}-service`, {
            apiVersion: "v1",
            kind: "Service",
            metadata: {
                name: `${ProjectName}-service`,
                namespace: ProjectName,
            },
            spec: {
                ports: [
                    {
                        port: 80,
                        targetPort: 8080,
                        protocol: "TCP",
                    },
                ],
                type: "NodePort",
                selector: {
                    app: ProjectName,
                },
            },
        });
        service.node.addDependency(albIngress);
        eksCluster
            .addManifest(`${ProjectName}-ingress`, {
            apiVersion: "extensions/v1beta1",
            kind: "Ingress",
            metadata: {
                name: `${ProjectName}-ingress`,
                namespace: `${ProjectName}`,
                annotations: {
                    "kubernetes.io/ingress.class": "alb",
                    "alb.ingress.kubernetes.io/scheme": "internet-facing",
                    "alb.ingress.kubernetes.io/target-type": "ip",
                    "alb.ingress.kubernetes.io/healthcheck-path": "/actuator/health",
                },
                labels: {
                    app: `${ProjectName}-ingress`,
                },
            },
            spec: {
                rules: [
                    {
                        http: {
                            paths: [
                                {
                                    path: "/*",
                                    backend: {
                                        serviceName: `${ProjectName}-service`,
                                        servicePort: 80,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        })
            .node.addDependency(service);
        const project = new codebuild.Project(this, `${ProjectName}-build`, {
            source: codebuild.Source.codeCommit({ repository }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.fromAsset(this, `${ProjectName}-build-image`, {
                    directory: "EKSBuild",
                }),
                privileged: true,
            },
            environmentVariables: {
                CLUSTER_NAME: {
                    value: `${eksCluster.clusterName}`,
                },
                ECR_REPO_URI: {
                    value: `${ecrRepo.repositoryUri}`,
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    pre_build: {
                        commands: [
                            "env",
                            "export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}",
                            "/usr/local/bin/entrypoint.sh",
                        ],
                    },
                    build: {
                        commands: [
                            `docker build -t $ECR_REPO_URI:$TAG .`,
                            "$(aws ecr get-login --no-include-email)",
                            "docker push $ECR_REPO_URI:$TAG",
                        ],
                    },
                    post_build: {
                        commands: [
                            `kubectl set image deployment ${ProjectName} ${ProjectName}=$ECR_REPO_URI:$TAG -n ${ProjectName}`,
                            `kubectl get svc -n ${ProjectName}`,
                        ],
                    },
                },
            }),
        });
        repository.onCommit("OnCommit", {
            target: new targets.CodeBuildProject(codebuild.Project.fromProjectArn(this, "OnCommitEvent", project.projectArn)),
        });
        ecrRepo.grantPullPush(project.role);
        eksCluster.awsAuth.addMastersRole(project.role);
        project.addToRolePolicy(new iam.PolicyStatement({
            actions: ["eks:DescribeCluster"],
            resources: [`${eksCluster.clusterArn}`],
        }));
        new cdk.CfnOutput(this, "CodeCommitRepoName", {
            value: `${repository.repositoryName}`,
        });
        new cdk.CfnOutput(this, "EcrRepoArn", {
            value: `${ecrRepo.repositoryArn}`,
        });
        new cdk.CfnOutput(this, "CodeBuildProjectArn", {
            value: `${project.projectArn}`,
        });
    }
}
exports.ProjectStack = ProjectStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBc0M7QUFDdEMsd0NBQXlDO0FBQ3pDLHdDQUF5QztBQUN6Qyx3Q0FBeUM7QUFDekMsd0NBQXlDO0FBQ3pDLG9EQUFxRDtBQUNyRCxzREFBdUQ7QUFDdkQsdURBQXdEO0FBRXhELE1BQU0sV0FBVyxHQUFHLHlDQUF5QyxDQUFDO0FBRTlELE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FDekQsSUFBSSxFQUNKLEdBQUcsV0FBVyxPQUFPLEVBQ3JCLFdBQVcsQ0FDWixDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxHQUFHLFdBQVcsRUFBRSxFQUFFO1lBQ3pELGNBQWMsRUFBRSxHQUFHLFdBQVcsRUFBRTtTQUNqQyxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsV0FBVyxNQUFNLEVBQUU7WUFDdEQsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNuRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsb0JBQW9CLEVBQUU7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxHQUFHLFdBQVcsTUFBTSxFQUFF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QUMvQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFoa0JELG9DQWdrQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2RrID0gcmVxdWlyZShcIkBhd3MtY2RrL2NvcmVcIik7XG5pbXBvcnQgZWMyID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1lYzJcIik7XG5pbXBvcnQgZWNyID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1lY3JcIik7XG5pbXBvcnQgZWtzID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1la3NcIik7XG5pbXBvcnQgaWFtID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1pYW1cIik7XG5pbXBvcnQgY29kZWJ1aWxkID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1jb2RlYnVpbGRcIik7XG5pbXBvcnQgY29kZWNvbW1pdCA9IHJlcXVpcmUoXCJAYXdzLWNkay9hd3MtY29kZWNvbW1pdFwiKTtcbmltcG9ydCB0YXJnZXRzID0gcmVxdWlyZShcIkBhd3MtY2RrL2F3cy1ldmVudHMtdGFyZ2V0c1wiKTtcblxuY29uc3QgUHJvamVjdE5hbWUgPSBcImNtci1idXNpbmVzcy1zZXJ2LWN1c3RvbWVyLXBheW1lbnRzLXBvY1wiO1xuXG5leHBvcnQgY2xhc3MgUHJvamVjdFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHJlcG9zaXRvcnkgPSBjb2RlY29tbWl0LlJlcG9zaXRvcnkuZnJvbVJlcG9zaXRvcnlOYW1lKFxuICAgICAgdGhpcyxcbiAgICAgIGAke1Byb2plY3ROYW1lfS1yZXBvYCxcbiAgICAgIFByb2plY3ROYW1lXG4gICAgKTtcblxuICAgIGNvbnN0IGVjclJlcG8gPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgYCR7UHJvamVjdE5hbWV9YCwge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6IGAke1Byb2plY3ROYW1lfWAsXG4gICAgfSk7XG5cbiAgICBjb25zdCBiYXNlVnBjID0gbmV3IGVjMi5WcGModGhpcywgYCR7UHJvamVjdE5hbWV9LXZwY2AsIHtcbiAgICAgIG1heEF6czogMyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNsdXN0ZXJBZG1pbiA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIkFkbWluUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uQWNjb3VudFJvb3RQcmluY2lwYWwoKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGVrc0NsdXN0ZXIgPSBuZXcgZWtzLkZhcmdhdGVDbHVzdGVyKHRoaXMsIGAke1Byb2plY3ROYW1lfS1la3NgLCB7XG4gICAgICB2cGM6IGJhc2VWcGMsXG4gICAgICB2ZXJzaW9uOiBla3MuS3ViZXJuZXRlc1ZlcnNpb24uVjFfMTksXG4gICAgICBtYXN0ZXJzUm9sZTogY2x1c3RlckFkbWluLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbnMgPSBla3NDbHVzdGVyLmFkZE1hbmlmZXN0KGAke1Byb2plY3ROYW1lfS1uc2AsIHtcbiAgICAgIGFwaVZlcnNpb246IFwidjFcIixcbiAgICAgIGtpbmQ6IFwiTmFtZXNwYWNlXCIsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBuYW1lOiBQcm9qZWN0TmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBwb2RSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGAke1Byb2plY3ROYW1lfS1wb2Qtcm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiZWtzLWZhcmdhdGUtcG9kcy5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcIkFtYXpvbkVLU0ZhcmdhdGVQb2RFeGVjdXRpb25Sb2xlUG9saWN5XCJcbiAgICAgICAgKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFxuICAgICAgICAgIFwiQ2xvdWRXYXRjaEFnZW50U2VydmVyUG9saWN5XCJcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBwb2RSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXCJzZGttZXRyaWNzOipcIl0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcG9kUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dHcm91cFwiLFxuICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIixcbiAgICAgICAgICBcImxvZ3M6UHV0TG9nRXZlbnRzXCIsXG4gICAgICAgICAgXCJsb2dzOkRlc2NyaWJlTG9nU3RyZWFtc1wiLFxuICAgICAgICBdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGVrc0NsdXN0ZXIuYWRkRmFyZ2F0ZVByb2ZpbGUoYCR7UHJvamVjdE5hbWV9LXByb2ZpbGVgLCB7XG4gICAgICBzZWxlY3RvcnM6IFt7IG5hbWVzcGFjZTogUHJvamVjdE5hbWUgfV0sXG4gICAgICBwb2RFeGVjdXRpb25Sb2xlOiBwb2RSb2xlLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2VydmljZUFjY291bnQgPSBla3NDbHVzdGVyLmFkZFNlcnZpY2VBY2NvdW50KFwiU2VydmljZUFjY291bnRcIiwge1xuICAgICAgbmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICBuYW1lc3BhY2U6IFwia3ViZS1zeXN0ZW1cIixcbiAgICB9KTtcblxuICAgIHNlcnZpY2VBY2NvdW50LmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJhY206RGVzY3JpYmVDZXJ0aWZpY2F0ZVwiLFxuICAgICAgICAgIFwiYWNtOkxpc3RDZXJ0aWZpY2F0ZXNcIixcbiAgICAgICAgICBcImFjbTpHZXRDZXJ0aWZpY2F0ZVwiLFxuICAgICAgICBdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHNlcnZpY2VBY2NvdW50LmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJlYzI6QXV0aG9yaXplU2VjdXJpdHlHcm91cEluZ3Jlc3NcIixcbiAgICAgICAgICBcImVjMjpDcmVhdGVTZWN1cml0eUdyb3VwXCIsXG4gICAgICAgICAgXCJlYzI6Q3JlYXRlVGFnc1wiLFxuICAgICAgICAgIFwiZWMyOkRlbGV0ZVRhZ3NcIixcbiAgICAgICAgICBcImVjMjpEZWxldGVTZWN1cml0eUdyb3VwXCIsXG4gICAgICAgICAgXCJlYzI6RGVzY3JpYmVBY2NvdW50QXR0cmlidXRlc1wiLFxuICAgICAgICAgIFwiZWMyOkRlc2NyaWJlQWRkcmVzc2VzXCIsXG4gICAgICAgICAgXCJlYzI6RGVzY3JpYmVJbnN0YW5jZXNcIixcbiAgICAgICAgICBcImVjMjpEZXNjcmliZUluc3RhbmNlU3RhdHVzXCIsXG4gICAgICAgICAgXCJlYzI6RGVzY3JpYmVJbnRlcm5ldEdhdGV3YXlzXCIsXG4gICAgICAgICAgXCJlYzI6RGVzY3JpYmVOZXR3b3JrSW50ZXJmYWNlc1wiLFxuICAgICAgICAgIFwiZWMyOkRlc2NyaWJlU2VjdXJpdHlHcm91cHNcIixcbiAgICAgICAgICBcImVjMjpEZXNjcmliZVN1Ym5ldHNcIixcbiAgICAgICAgICBcImVjMjpEZXNjcmliZVRhZ3NcIixcbiAgICAgICAgICBcImVjMjpEZXNjcmliZVZwY3NcIixcbiAgICAgICAgICBcImVjMjpNb2RpZnlJbnN0YW5jZUF0dHJpYnV0ZVwiLFxuICAgICAgICAgIFwiZWMyOk1vZGlmeU5ldHdvcmtJbnRlcmZhY2VBdHRyaWJ1dGVcIixcbiAgICAgICAgICBcImVjMjpSZXZva2VTZWN1cml0eUdyb3VwSW5ncmVzc1wiLFxuICAgICAgICBdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHNlcnZpY2VBY2NvdW50LmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpBZGRMaXN0ZW5lckNlcnRpZmljYXRlc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6QWRkVGFnc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6Q3JlYXRlTGlzdGVuZXJcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkNyZWF0ZUxvYWRCYWxhbmNlclwiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6Q3JlYXRlUnVsZVwiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6Q3JlYXRlVGFyZ2V0R3JvdXBcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkRlbGV0ZUxpc3RlbmVyXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZWxldGVMb2FkQmFsYW5jZXJcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkRlbGV0ZVJ1bGVcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkRlbGV0ZVRhcmdldEdyb3VwXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXJlZ2lzdGVyVGFyZ2V0c1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6RGVzY3JpYmVMaXN0ZW5lckNlcnRpZmljYXRlc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6RGVzY3JpYmVMaXN0ZW5lcnNcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkRlc2NyaWJlTG9hZEJhbGFuY2Vyc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6RGVzY3JpYmVMb2FkQmFsYW5jZXJBdHRyaWJ1dGVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXNjcmliZVJ1bGVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXNjcmliZVNTTFBvbGljaWVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXNjcmliZVRhZ3NcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOkRlc2NyaWJlVGFyZ2V0R3JvdXBzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpEZXNjcmliZVRhcmdldEdyb3VwQXR0cmlidXRlc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6RGVzY3JpYmVUYXJnZXRIZWFsdGhcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOk1vZGlmeUxpc3RlbmVyXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpNb2RpZnlMb2FkQmFsYW5jZXJBdHRyaWJ1dGVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpNb2RpZnlSdWxlXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpNb2RpZnlUYXJnZXRHcm91cFwiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6TW9kaWZ5VGFyZ2V0R3JvdXBBdHRyaWJ1dGVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpSZWdpc3RlclRhcmdldHNcIixcbiAgICAgICAgICBcImVsYXN0aWNsb2FkYmFsYW5jaW5nOlJlbW92ZUxpc3RlbmVyQ2VydGlmaWNhdGVzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpSZW1vdmVUYWdzXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpTZXRJcEFkZHJlc3NUeXBlXCIsXG4gICAgICAgICAgXCJlbGFzdGljbG9hZGJhbGFuY2luZzpTZXRTZWN1cml0eUdyb3Vwc1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6U2V0U3VibmV0c1wiLFxuICAgICAgICAgIFwiZWxhc3RpY2xvYWRiYWxhbmNpbmc6U2V0V2ViQWNsXCIsXG4gICAgICAgIF0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgc2VydmljZUFjY291bnQuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImlhbTpDcmVhdGVTZXJ2aWNlTGlua2VkUm9sZVwiLFxuICAgICAgICAgIFwiaWFtOkdldFNlcnZlckNlcnRpZmljYXRlXCIsXG4gICAgICAgICAgXCJpYW06TGlzdFNlcnZlckNlcnRpZmljYXRlc1wiLFxuICAgICAgICBdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHNlcnZpY2VBY2NvdW50LmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXCJjb2duaXRvLWlkcDpEZXNjcmliZVVzZXJQb29sQ2xpZW50XCJdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHNlcnZpY2VBY2NvdW50LmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJ3YWYtcmVnaW9uYWw6R2V0V2ViQUNMRm9yUmVzb3VyY2VcIixcbiAgICAgICAgICBcIndhZi1yZWdpb25hbDpHZXRXZWJBQ0xcIixcbiAgICAgICAgICBcIndhZi1yZWdpb25hbDpBc3NvY2lhdGVXZWJBQ0xcIixcbiAgICAgICAgICBcIndhZi1yZWdpb25hbDpEaXNhc3NvY2lhdGVXZWJBQ0xcIixcbiAgICAgICAgXSxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBzZXJ2aWNlQWNjb3VudC5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1widGFnOkdldFJlc291cmNlc1wiLCBcInRhZzpUYWdSZXNvdXJjZXNcIl0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgc2VydmljZUFjY291bnQuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcIndhZjpHZXRXZWJBQ0xcIl0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgc2VydmljZUFjY291bnQuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcIndhZnYyOkdldFdlYkFDTFwiLFxuICAgICAgICAgIFwid2FmdjI6R2V0V2ViQUNMRm9yUmVzb3VyY2VcIixcbiAgICAgICAgICBcIndhZnYyOkFzc29jaWF0ZVdlYkFDTFwiLFxuICAgICAgICAgIFwid2FmdjI6RGlzYXNzb2NpYXRlV2ViQUNMXCIsXG4gICAgICAgIF0sXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgc2VydmljZUFjY291bnQuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcInNoaWVsZDpEZXNjcmliZVByb3RlY3Rpb25cIixcbiAgICAgICAgICBcInNoaWVsZDpHZXRTdWJzY3JpcHRpb25TdGF0ZVwiLFxuICAgICAgICAgIFwic2hpZWxkOkRlbGV0ZVByb3RlY3Rpb25cIixcbiAgICAgICAgICBcInNoaWVsZDpDcmVhdGVQcm90ZWN0aW9uXCIsXG4gICAgICAgICAgXCJzaGllbGQ6RGVzY3JpYmVTdWJzY3JpcHRpb25cIixcbiAgICAgICAgICBcInNoaWVsZDpMaXN0UHJvdGVjdGlvbnNcIixcbiAgICAgICAgXSxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBla3NDbHVzdGVyXG4gICAgICAuYWRkTWFuaWZlc3QoYCR7UHJvamVjdE5hbWV9LWNsdXN0ZXItcm9sZWAsIHtcbiAgICAgICAgYXBpVmVyc2lvbjogXCJyYmFjLmF1dGhvcml6YXRpb24uazhzLmlvL3YxXCIsXG4gICAgICAgIGtpbmQ6IFwiQ2x1c3RlclJvbGVcIixcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICBsYWJlbHM6IHtcbiAgICAgICAgICAgIFwiYXBwLmt1YmVybmV0ZXMuaW8vbmFtZVwiOiBcImFsYi1pbmdyZXNzLWNvbnRyb2xsZXJcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIG5hbWU6IFwiYWxiLWluZ3Jlc3MtY29udHJvbGxlclwiLFxuICAgICAgICB9LFxuICAgICAgICBydWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGFwaUdyb3VwczogW1wiXCIsIFwiZXh0ZW5zaW9uc1wiXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICBcImNvbmZpZ21hcHNcIixcbiAgICAgICAgICAgICAgXCJlbmRwb2ludHNcIixcbiAgICAgICAgICAgICAgXCJldmVudHNcIixcbiAgICAgICAgICAgICAgXCJpbmdyZXNzZXNcIixcbiAgICAgICAgICAgICAgXCJpbmdyZXNzZXMvc3RhdHVzXCIsXG4gICAgICAgICAgICAgIFwic2VydmljZXNcIixcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB2ZXJiczogW1wiY3JlYXRlXCIsIFwiZ2V0XCIsIFwibGlzdFwiLCBcInVwZGF0ZVwiLCBcIndhdGNoXCIsIFwicGF0Y2hcIl0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBhcGlHcm91cHM6IFtcIlwiLCBcImV4dGVuc2lvbnNcIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcIm5vZGVzXCIsIFwicG9kc1wiLCBcInNlY3JldHNcIiwgXCJzZXJ2aWNlc1wiLCBcIm5hbWVzcGFjZXNcIl0sXG4gICAgICAgICAgICB2ZXJiczogW1wiZ2V0XCIsIFwibGlzdFwiLCBcIndhdGNoXCJdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICAgLm5vZGUuYWRkRGVwZW5kZW5jeShzZXJ2aWNlQWNjb3VudCk7XG5cbiAgICBla3NDbHVzdGVyXG4gICAgICAuYWRkTWFuaWZlc3QoYCR7UHJvamVjdE5hbWV9LWNsdXN0ZXItYmluZGluZ2AsIHtcbiAgICAgICAgYXBpVmVyc2lvbjogXCJyYmFjLmF1dGhvcml6YXRpb24uazhzLmlvL3YxXCIsXG4gICAgICAgIGtpbmQ6IFwiQ2x1c3RlclJvbGVCaW5kaW5nXCIsXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgbGFiZWxzOiB7XG4gICAgICAgICAgICBcImFwcC5rdWJlcm5ldGVzLmlvL25hbWVcIjogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuYW1lOiBcImFsYi1pbmdyZXNzLWNvbnRyb2xsZXJcIixcbiAgICAgICAgfSxcbiAgICAgICAgcm9sZVJlZjoge1xuICAgICAgICAgIGFwaUdyb3VwOiBcInJiYWMuYXV0aG9yaXphdGlvbi5rOHMuaW9cIixcbiAgICAgICAgICBraW5kOiBcIkNsdXN0ZXJSb2xlXCIsXG4gICAgICAgICAgbmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHN1YmplY3RzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2luZDogXCJTZXJ2aWNlQWNjb3VudFwiLFxuICAgICAgICAgICAgbmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwia3ViZS1zeXN0ZW1cIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5ub2RlLmFkZERlcGVuZGVuY3koc2VydmljZUFjY291bnQpO1xuXG4gICAgY29uc3QgYWxiSW5ncmVzcyA9IGVrc0NsdXN0ZXIuYWRkTWFuaWZlc3QoYCR7UHJvamVjdE5hbWV9LWFsYi1pbmdyZXNzYCwge1xuICAgICAgYXBpVmVyc2lvbjogXCJhcHBzL3YxXCIsXG4gICAgICBraW5kOiBcIkRlcGxveW1lbnRcIixcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGxhYmVsczoge1xuICAgICAgICAgIFwiYXBwLmt1YmVybmV0ZXMuaW8vbmFtZVwiOiBcImFsYi1pbmdyZXNzLWNvbnRyb2xsZXJcIixcbiAgICAgICAgfSxcbiAgICAgICAgbmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgIG5hbWVzcGFjZTogXCJrdWJlLXN5c3RlbVwiLFxuICAgICAgfSxcbiAgICAgIHNwZWM6IHtcbiAgICAgICAgc2VsZWN0b3I6IHtcbiAgICAgICAgICBtYXRjaExhYmVsczoge1xuICAgICAgICAgICAgXCJhcHAua3ViZXJuZXRlcy5pby9uYW1lXCI6IFwiYWxiLWluZ3Jlc3MtY29udHJvbGxlclwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIGxhYmVsczoge1xuICAgICAgICAgICAgICBcImFwcC5rdWJlcm5ldGVzLmlvL25hbWVcIjogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3BlYzoge1xuICAgICAgICAgICAgY29udGFpbmVyczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgICAgICAgYXJnczogW1xuICAgICAgICAgICAgICAgICAgXCItLWluZ3Jlc3MtY2xhc3M9YWxiXCIsXG4gICAgICAgICAgICAgICAgICBgLS1jbHVzdGVyLW5hbWU9JHtla3NDbHVzdGVyLmNsdXN0ZXJOYW1lfWAsXG4gICAgICAgICAgICAgICAgICBgLS1hd3MtdnBjLWlkPSR7YmFzZVZwYy52cGNJZH1gLFxuICAgICAgICAgICAgICAgICAgYC0tYXdzLXJlZ2lvbj0ke3RoaXMucmVnaW9ufWAsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBpbWFnZTogXCJkb2NrZXIuaW8vYW1hem9uL2F3cy1hbGItaW5ncmVzcy1jb250cm9sbGVyOnYxLjEuOFwiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHNlcnZpY2VBY2NvdW50TmFtZTogXCJhbGItaW5ncmVzcy1jb250cm9sbGVyXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhbGJJbmdyZXNzLm5vZGUuYWRkRGVwZW5kZW5jeShzZXJ2aWNlQWNjb3VudCk7XG5cbiAgICBjb25zdCBjbG91ZFdhdGNoQWdlbnRDb25maWcgPSBla3NDbHVzdGVyLmFkZE1hbmlmZXN0KFxuICAgICAgXCJjd2FnZW50Y29uZmlnLXNpZGVjYXJcIixcbiAgICAgIHtcbiAgICAgICAgYXBpVmVyc2lvbjogXCJ2MVwiLFxuICAgICAgICBraW5kOiBcIkNvbmZpZ01hcFwiLFxuICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgIG5hbWU6IFwiY3dhZ2VudGNvbmZpZy1zaWRlY2FyXCIsXG4gICAgICAgICAgbmFtZXNwYWNlOiBQcm9qZWN0TmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIFwiY3dhZ2VudGNvbmZpZy5qc29uXCI6XG4gICAgICAgICAgICAne1xcbiAgXCJhZ2VudFwiOiB7XFxuICAgIFwib21pdF9ob3N0bmFtZVwiOiB0cnVlLCBcInJlZ2lvblwiOiBcInVzLWVhc3QtMVwiXFxuICB9LFxcbiAgXCJtZXRyaWNzXCI6IHtcXG4gICAgXCJtZXRyaWNzX2NvbGxlY3RlZFwiOiB7XFxuICAgICAgXCJzdGF0c2RcIjoge1xcbiAgICAgICAgXCJzZXJ2aWNlX2FkZHJlc3NcIjpcIjo4MTI1XCJcXG4gICAgICB9XFxuICAgIH1cXG4gIH0sXFxuICBcImxvZ3NcIjoge1xcbiAgICBcIm1ldHJpY3NfY29sbGVjdGVkXCI6IHtcXG4gICAgICBcImVtZlwiOiB7fVxcbiAgICB9XFxuICB9LFxcbiAgXCJjc21cIjoge1xcbiAgICBcInNlcnZpY2VfYWRkcmVzc2VzXCI6IFtcInVkcDQ6Ly8xMjcuMC4wLjE6MzEwMDBcIiwgXCJ1ZHA2Oi8vWzo6MV06MzEwMDBcIl0sXFxuICAgIFwibWVtb3J5X2xpbWl0X2luX21iXCI6IDIwXFxuICB9XFxufVxcbicsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNsb3VkV2F0Y2hBZ2VudENvbmZpZy5ub2RlLmFkZERlcGVuZGVuY3kobnMpO1xuXG4gICAgZWtzQ2x1c3RlclxuICAgICAgLmFkZE1hbmlmZXN0KGAke1Byb2plY3ROYW1lfS1kZXBsb3ltZW50YCwge1xuICAgICAgICBhcGlWZXJzaW9uOiBcImFwcHMvdjFcIixcbiAgICAgICAga2luZDogXCJEZXBsb3ltZW50XCIsXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgbmFtZTogUHJvamVjdE5hbWUsXG4gICAgICAgICAgbmFtZXNwYWNlOiBQcm9qZWN0TmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3BlYzoge1xuICAgICAgICAgIHNlbGVjdG9yOiB7XG4gICAgICAgICAgICBtYXRjaExhYmVsczoge1xuICAgICAgICAgICAgICBhcHA6IFByb2plY3ROYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlcGxpY2FzOiAzLFxuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgICAgICBsYWJlbHM6IHtcbiAgICAgICAgICAgICAgICBhcHA6IFByb2plY3ROYW1lLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNwZWM6IHtcbiAgICAgICAgICAgICAgY29udGFpbmVyczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGltYWdlOiBgJHtlY3JSZXBvLnJlcG9zaXRvcnlVcml9OmxhdGVzdGAsXG4gICAgICAgICAgICAgICAgICBpbWFnZVB1bGxQb2xpY3k6IFwiQWx3YXlzXCIsXG4gICAgICAgICAgICAgICAgICBuYW1lOiBQcm9qZWN0TmFtZSxcbiAgICAgICAgICAgICAgICAgIHBvcnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb250YWluZXJQb3J0OiA4MDgwLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIGVudjogW1xuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQVdTX0NTTV9FTkFCTEVEXCIsIHZhbHVlOiBcInRydWVcIiB9LFxuICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IFwiQVdTX0NTTV9QT1JUXCIsIHZhbHVlOiBcIjMxMDAwXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBuYW1lOiBcIkFXU19DU01fSE9TVFwiLCB2YWx1ZTogXCIxMjcuMC4wLjFcIiB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIG5hbWU6IFwiY2xvdWR3YXRjaC1hZ2VudFwiLFxuICAgICAgICAgICAgICAgICAgaW1hZ2U6IFwiYW1hem9uL2Nsb3Vkd2F0Y2gtYWdlbnQ6bGF0ZXN0XCIsXG4gICAgICAgICAgICAgICAgICBpbWFnZVB1bGxQb2xpY3k6IFwiQWx3YXlzXCIsXG4gICAgICAgICAgICAgICAgICBlbnY6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiUE9EX05BTUVcIixcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZUZyb206IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkUmVmOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkUGF0aDogXCJtZXRhZGF0YS5uYW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiB7XG4gICAgICAgICAgICAgICAgICAgIGxpbWl0czoge1xuICAgICAgICAgICAgICAgICAgICAgIGNwdTogXCIxMDBtXCIsXG4gICAgICAgICAgICAgICAgICAgICAgbWVtb3J5OiBcIjEwME1pXCIsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgY3B1OiBcIjMybVwiLFxuICAgICAgICAgICAgICAgICAgICAgIG1lbW9yeTogXCIyNE1pXCIsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgdm9sdW1lTW91bnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImN3YWdlbnRjb25maWdcIixcbiAgICAgICAgICAgICAgICAgICAgICBtb3VudFBhdGg6IFwiL2V0Yy9jd2FnZW50Y29uZmlnXCIsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHZvbHVtZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBuYW1lOiBcImN3YWdlbnRjb25maWdcIixcbiAgICAgICAgICAgICAgICAgIGNvbmZpZ01hcDoge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImN3YWdlbnRjb25maWctc2lkZWNhclwiLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgIC5ub2RlLmFkZERlcGVuZGVuY3koY2xvdWRXYXRjaEFnZW50Q29uZmlnKTtcblxuICAgIGNvbnN0IHNlcnZpY2UgPSBla3NDbHVzdGVyLmFkZE1hbmlmZXN0KGAke1Byb2plY3ROYW1lfS1zZXJ2aWNlYCwge1xuICAgICAgYXBpVmVyc2lvbjogXCJ2MVwiLFxuICAgICAga2luZDogXCJTZXJ2aWNlXCIsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBuYW1lOiBgJHtQcm9qZWN0TmFtZX0tc2VydmljZWAsXG4gICAgICAgIG5hbWVzcGFjZTogUHJvamVjdE5hbWUsXG4gICAgICB9LFxuICAgICAgc3BlYzoge1xuICAgICAgICBwb3J0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBvcnQ6IDgwLFxuICAgICAgICAgICAgdGFyZ2V0UG9ydDogODA4MCxcbiAgICAgICAgICAgIHByb3RvY29sOiBcIlRDUFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6IFwiTm9kZVBvcnRcIixcbiAgICAgICAgc2VsZWN0b3I6IHtcbiAgICAgICAgICBhcHA6IFByb2plY3ROYW1lLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHNlcnZpY2Uubm9kZS5hZGREZXBlbmRlbmN5KGFsYkluZ3Jlc3MpO1xuXG4gICAgZWtzQ2x1c3RlclxuICAgICAgLmFkZE1hbmlmZXN0KGAke1Byb2plY3ROYW1lfS1pbmdyZXNzYCwge1xuICAgICAgICBhcGlWZXJzaW9uOiBcImV4dGVuc2lvbnMvdjFiZXRhMVwiLFxuICAgICAgICBraW5kOiBcIkluZ3Jlc3NcIixcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICBuYW1lOiBgJHtQcm9qZWN0TmFtZX0taW5ncmVzc2AsXG4gICAgICAgICAgbmFtZXNwYWNlOiBgJHtQcm9qZWN0TmFtZX1gLFxuICAgICAgICAgIGFubm90YXRpb25zOiB7XG4gICAgICAgICAgICBcImt1YmVybmV0ZXMuaW8vaW5ncmVzcy5jbGFzc1wiOiBcImFsYlwiLFxuICAgICAgICAgICAgXCJhbGIuaW5ncmVzcy5rdWJlcm5ldGVzLmlvL3NjaGVtZVwiOiBcImludGVybmV0LWZhY2luZ1wiLFxuICAgICAgICAgICAgXCJhbGIuaW5ncmVzcy5rdWJlcm5ldGVzLmlvL3RhcmdldC10eXBlXCI6IFwiaXBcIixcbiAgICAgICAgICAgIFwiYWxiLmluZ3Jlc3Mua3ViZXJuZXRlcy5pby9oZWFsdGhjaGVjay1wYXRoXCI6IFwiL2FjdHVhdG9yL2hlYWx0aFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbGFiZWxzOiB7XG4gICAgICAgICAgICBhcHA6IGAke1Byb2plY3ROYW1lfS1pbmdyZXNzYCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBzcGVjOiB7XG4gICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaHR0cDoge1xuICAgICAgICAgICAgICAgIHBhdGhzOiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IFwiLypcIixcbiAgICAgICAgICAgICAgICAgICAgYmFja2VuZDoge1xuICAgICAgICAgICAgICAgICAgICAgIHNlcnZpY2VOYW1lOiBgJHtQcm9qZWN0TmFtZX0tc2VydmljZWAsXG4gICAgICAgICAgICAgICAgICAgICAgc2VydmljZVBvcnQ6IDgwLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgIC5ub2RlLmFkZERlcGVuZGVuY3koc2VydmljZSk7XG5cbiAgICBjb25zdCBwcm9qZWN0ID0gbmV3IGNvZGVidWlsZC5Qcm9qZWN0KHRoaXMsIGAke1Byb2plY3ROYW1lfS1idWlsZGAsIHtcbiAgICAgIHNvdXJjZTogY29kZWJ1aWxkLlNvdXJjZS5jb2RlQ29tbWl0KHsgcmVwb3NpdG9yeSB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuZnJvbUFzc2V0KFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgYCR7UHJvamVjdE5hbWV9LWJ1aWxkLWltYWdlYCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkaXJlY3Rvcnk6IFwiRUtTQnVpbGRcIixcbiAgICAgICAgICB9XG4gICAgICAgICksXG4gICAgICAgIHByaXZpbGVnZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgQ0xVU1RFUl9OQU1FOiB7XG4gICAgICAgICAgdmFsdWU6IGAke2Vrc0NsdXN0ZXIuY2x1c3Rlck5hbWV9YCxcbiAgICAgICAgfSxcbiAgICAgICAgRUNSX1JFUE9fVVJJOiB7XG4gICAgICAgICAgdmFsdWU6IGAke2VjclJlcG8ucmVwb3NpdG9yeVVyaX1gLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgdmVyc2lvbjogXCIwLjJcIixcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgcHJlX2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICBcImVudlwiLFxuICAgICAgICAgICAgICBcImV4cG9ydCBUQUc9JHtDT0RFQlVJTERfUkVTT0xWRURfU09VUkNFX1ZFUlNJT059XCIsXG4gICAgICAgICAgICAgIFwiL3Vzci9sb2NhbC9iaW4vZW50cnlwb2ludC5zaFwiLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICBgZG9ja2VyIGJ1aWxkIC10ICRFQ1JfUkVQT19VUkk6JFRBRyAuYCxcbiAgICAgICAgICAgICAgXCIkKGF3cyBlY3IgZ2V0LWxvZ2luIC0tbm8taW5jbHVkZS1lbWFpbClcIixcbiAgICAgICAgICAgICAgXCJkb2NrZXIgcHVzaCAkRUNSX1JFUE9fVVJJOiRUQUdcIixcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb3N0X2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICBga3ViZWN0bCBzZXQgaW1hZ2UgZGVwbG95bWVudCAke1Byb2plY3ROYW1lfSAke1Byb2plY3ROYW1lfT0kRUNSX1JFUE9fVVJJOiRUQUcgLW4gJHtQcm9qZWN0TmFtZX1gLFxuICAgICAgICAgICAgICBga3ViZWN0bCBnZXQgc3ZjIC1uICR7UHJvamVjdE5hbWV9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgcmVwb3NpdG9yeS5vbkNvbW1pdChcIk9uQ29tbWl0XCIsIHtcbiAgICAgIHRhcmdldDogbmV3IHRhcmdldHMuQ29kZUJ1aWxkUHJvamVjdChcbiAgICAgICAgY29kZWJ1aWxkLlByb2plY3QuZnJvbVByb2plY3RBcm4oXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBcIk9uQ29tbWl0RXZlbnRcIixcbiAgICAgICAgICBwcm9qZWN0LnByb2plY3RBcm5cbiAgICAgICAgKVxuICAgICAgKSxcbiAgICB9KTtcblxuICAgIGVjclJlcG8uZ3JhbnRQdWxsUHVzaChwcm9qZWN0LnJvbGUhKTtcbiAgICBla3NDbHVzdGVyLmF3c0F1dGguYWRkTWFzdGVyc1JvbGUocHJvamVjdC5yb2xlISk7XG4gICAgcHJvamVjdC5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFtcImVrczpEZXNjcmliZUNsdXN0ZXJcIl0sXG4gICAgICAgIHJlc291cmNlczogW2Ake2Vrc0NsdXN0ZXIuY2x1c3RlckFybn1gXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQ29kZUNvbW1pdFJlcG9OYW1lXCIsIHtcbiAgICAgIHZhbHVlOiBgJHtyZXBvc2l0b3J5LnJlcG9zaXRvcnlOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJFY3JSZXBvQXJuXCIsIHtcbiAgICAgIHZhbHVlOiBgJHtlY3JSZXBvLnJlcG9zaXRvcnlBcm59YCxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkNvZGVCdWlsZFByb2plY3RBcm5cIiwge1xuICAgICAgdmFsdWU6IGAke3Byb2plY3QucHJvamVjdEFybn1gLFxuICAgIH0pO1xuICB9XG59XG4iXX0=