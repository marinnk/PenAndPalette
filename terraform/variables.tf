variable "project_name" {
  description = "リソース名のプレフィックスに使うプロジェクト名"
  type        = string
  default     = "pen-and-palette"
}

variable "aws_region" {
  description = "構築先のAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "backend_image_tag" {
  description = "ECSタスク定義が参照するバックエンドDockerイメージのタグ"
  type        = string
  default     = "latest"
}

variable "db_name" {
  description = "RDSのデータベース名（backend/config/settings.py の DB_NAME デフォルトに合わせる）"
  type        = string
  default     = "pen_and_palette"
}

variable "db_username" {
  description = "RDSのマスターユーザー名（backend/config/settings.py の DB_USER デフォルトに合わせる）"
  type        = string
  default     = "pen_and_palette"
}
