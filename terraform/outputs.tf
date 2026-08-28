output "cloudfront_domain_name" {
  description = "アプリにアクセスするためのCloudFrontドメイン（このURLをbrowserで開く）"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "デプロイ後のキャッシュ無効化（aws cloudfront create-invalidation）に使う"
  value       = aws_cloudfront_distribution.main.id
}

output "alb_dns_name" {
  description = "ALBのDNS名（デバッグ用。通常はCloudFront経由でアクセスする）"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "バックエンドDockerイメージのpush先"
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_bucket_name" {
  description = "フロントエンドの静的ファイルを配置するS3バケット名"
  value       = aws_s3_bucket.frontend.bucket
}

output "media_bucket_name" {
  description = "投稿・コメント・アイコン画像を保存するS3バケット名"
  value       = aws_s3_bucket.media.bucket
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}

output "github_deploy_role_arn" {
  description = ".github/workflows/deploy.yml の AWS_DEPLOY_ROLE_ARN（Variables）に設定する値"
  value       = aws_iam_role.github_deploy.arn
}
