# GitHub Actions（.github/workflows/deploy.yml）から OIDC で AssumeRole できるデプロイ用ロール。
# 長期アクセスキーを GitHub Secrets に置かずに済む。

variable "github_repository" {
  description = "デプロイを許可する GitHub リポジトリ（owner/repo）"
  type        = string
  default     = "marinnk/PenAndPalette"
}

variable "github_subject_claims" {
  description = <<-EOT
    信頼ポリシーの token.actions.githubusercontent.com:sub にマッチさせるパターン（StringLike、OR）。
    このアカウント/組織が「Customize the OIDC subject claims」で不変ID（owner@<id>/repo@<id>）を
    有効にしている場合、sub は `repo:marinnk/PenAndPalette:...` ではなく
    `repo:marinnk@99700676/PenAndPalette@1341790095:...` になるため、両形式を許可する。
  EOT
  type        = list(string)
  default = [
    "repo:marinnk/PenAndPalette:*",
    "repo:marinnk@99700676/PenAndPalette@1341790095:*",
  ]
}

variable "create_github_oidc_provider" {
  description = <<-EOT
    GitHub Actions 用の IAM OIDC プロバイダを作成するか。アカウントに既に
    token.actions.githubusercontent.com のプロバイダがある場合は false にし、
    既存のものを terraform import するか、data 参照に切り替える。
  EOT
  type        = bool
  default     = true
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # GitHub OIDC は 2023 年以降サムプリント検証を必須としないが、プロバイダ作成には
  # 何らかの値が必要なため GitHub 公式ドキュメント記載の値を置く
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = { Name = "${var.project_name}-github-oidc" }
}

locals {
  github_oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # このリポジトリからの実行のみ許可（ブランチ・環境は問わない = workflow_dispatch 前提）。
    # 不変IDが有効なアカウントでは sub が owner@<id>/repo@<id> 形式になるため両形式を許可する。
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.github_subject_claims
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.project_name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_assume.json
  tags               = { Name = "${var.project_name}-github-deploy" }
}

data "aws_iam_policy_document" "github_deploy" {
  # ECR: イメージの push
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }

  # ECS: サービスの強制再デプロイと状態確認
  statement {
    sid       = "EcsDeploy"
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = [aws_ecs_service.backend.id]
  }
  statement {
    sid       = "EcsDescribe"
    actions   = ["ecs:DescribeTasks", "ecs:ListTasks"]
    resources = ["*"]
    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.main.arn]
    }
  }

  # S3: フロントエンドの静的ファイル配信
  statement {
    sid       = "S3FrontendSync"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
    resources = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
  }

  # CloudFront: デプロイ後のキャッシュ無効化（+ ワークフローが配信 ID を引くための list）
  statement {
    sid       = "CloudFrontInvalidate"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.main.arn]
  }
  statement {
    sid       = "CloudFrontList"
    actions   = ["cloudfront:ListDistributions"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.project_name}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
