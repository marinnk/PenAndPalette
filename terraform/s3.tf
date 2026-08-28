# フロントエンド静的ファイル用・画像用ともに非公開バケットとし、CloudFront（OAC）経由でのみ
# 配信する（基本設計書 7章：RaiseTechSNS はアバター用バケットを公開のままにしていたが、
# PenAndPalette では画像用バケットも非公開に統一する）。

locals {
  s3_buckets = {
    frontend = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
    media    = "${var.project_name}-media-${data.aws_caller_identity.current.account_id}"
  }
}

resource "aws_s3_bucket" "frontend" {
  bucket        = local.s3_buckets.frontend
  force_destroy = true
  tags          = { Name = "${var.project_name}-frontend" }
}

resource "aws_s3_bucket" "media" {
  bucket        = local.s3_buckets.media
  force_destroy = true
  tags          = { Name = "${var.project_name}-media" }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront ディストリビューション（このアカウントの、このディストリビューション）からの
# GetObject のみ許可する
data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    sid       = "AllowCloudFrontServicePrincipal"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

data "aws_iam_policy_document" "media_bucket" {
  statement {
    sid       = "AllowCloudFrontServicePrincipal"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket     = aws_s3_bucket.frontend.id
  policy     = data.aws_iam_policy_document.frontend_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

resource "aws_s3_bucket_policy" "media" {
  bucket     = aws_s3_bucket.media.id
  policy     = data.aws_iam_policy_document.media_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.media]
}
