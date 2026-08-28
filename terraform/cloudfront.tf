# フロント静的ファイル用S3と画像用S3の両方に使う OAC（どちらもオリジンタイプはs3）
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# AWS管理のキャッシュ・オリジンリクエストポリシー（自前定義せず既存のものを参照する）
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  # Cookie・クエリ文字列・ほぼ全ヘッダーをオリジン（ALB）へそのまま転送する。
  # Cookie認証（access_token/refresh_token）と、settings.py が読む
  # CloudFront-Forwarded-Proto ヘッダーを成立させるために必須
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All" # 日本からのアクセスを想定し全エッジを使う

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "s3-media"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-backend"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # ALBに証明書がないため（独自ドメイン導入時に見直す）
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # デフォルト：フロントの静的ファイル（S3）
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # /media/* → 画像用S3（OAC経由）。ファイル名はUUIDで不変のため積極的にキャッシュする。
  # backend の django-storages は location="media" のため、S3キーは media/<folder>/<uuid> となり
  # CloudFront はパスをそのままキーとして渡せる（オリジンパスの書き換え不要）。
  ordered_cache_behavior {
    path_pattern           = "/media/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-media"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # /api/* → ALB（バックエンドAPI）。フロントと同一オリジンに見せることで
  # Cookie認証をそのまま成立させる（docs/infrastructure-design.md 参照）
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "alb-backend"
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # 独自ドメインを使わないため、CloudFrontのデフォルト証明書（*.cloudfront.net）を使う
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.project_name}-cloudfront" }
}
