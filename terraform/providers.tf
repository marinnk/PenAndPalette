terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }

  # state はローカル管理とする（個人学習用途のため、S3等のリモートバックエンドは使わない。
  # 詳細は docs/infrastructure-design.md 参照）
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
