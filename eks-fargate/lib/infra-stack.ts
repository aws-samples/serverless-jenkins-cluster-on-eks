import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import ecr = require("@aws-cdk/aws-ecr");
import eks = require("@aws-cdk/aws-eks");
import iam = require("@aws-cdk/aws-iam");
import codebuild = require("@aws-cdk/aws-codebuild");
import codecommit = require("@aws-cdk/aws-codecommit");
import targets = require("@aws-cdk/aws-events-targets");

const ProjectName = "cmr-business-serv-customer-payments-poc";

export class ProjectStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = codecommit.Repository.fromRepositoryName(
      this,
      `${ProjectName}-repo`,
      ProjectName
    );

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
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonEKSFargatePodExecutionRolePolicy"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy"
        ),
      ],
    });

    podRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sdkmetrics:*"],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    podRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    eksCluster.addFargateProfile(`${ProjectName}-profile`, {
      selectors: [{ namespace: ProjectName }],
      podExecutionRole: podRole,
    });

    const serviceAccount = eksCluster.addServiceAccount("ServiceAccount", {
      name: "alb-ingress-controller",
      namespace: "kube-system",
    });

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "acm:DescribeCertificate",
          "acm:ListCertificates",
          "acm:GetCertificate",
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "iam:CreateServiceLinkedRole",
          "iam:GetServerCertificate",
          "iam:ListServerCertificates",
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:DescribeUserPoolClient"],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "waf-regional:GetWebACLForResource",
          "waf-regional:GetWebACL",
          "waf-regional:AssociateWebACL",
          "waf-regional:DisassociateWebACL",
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: ["tag:GetResources", "tag:TagResources"],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: ["waf:GetWebACL"],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "wafv2:GetWebACL",
          "wafv2:GetWebACLForResource",
          "wafv2:AssociateWebACL",
          "wafv2:DisassociateWebACL",
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    serviceAccount.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

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

    const cloudWatchAgentConfig = eksCluster.addManifest(
      "cwagentconfig-sidecar",
      {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
          name: "cwagentconfig-sidecar",
          namespace: ProjectName,
        },
        data: {
          "cwagentconfig.json":
            '{\n  "agent": {\n    "omit_hostname": true, "region": "us-east-1"\n  },\n  "metrics": {\n    "metrics_collected": {\n      "statsd": {\n        "service_address":":8125"\n      }\n    }\n  },\n  "logs": {\n    "metrics_collected": {\n      "emf": {}\n    }\n  },\n  "csm": {\n    "service_addresses": ["udp4://127.0.0.1:31000", "udp6://[::1]:31000"],\n    "memory_limit_in_mb": 20\n  }\n}\n',
        },
      }
    );

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
        buildImage: codebuild.LinuxBuildImage.fromAsset(
          this,
          `${ProjectName}-build-image`,
          {
            directory: "EKSBuild",
          }
        ),
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
      target: new targets.CodeBuildProject(
        codebuild.Project.fromProjectArn(
          this,
          "OnCommitEvent",
          project.projectArn
        )
      ),
    });

    ecrRepo.grantPullPush(project.role!);
    eksCluster.awsAuth.addMastersRole(project.role!);
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["eks:DescribeCluster"],
        resources: [`${eksCluster.clusterArn}`],
      })
    );

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
