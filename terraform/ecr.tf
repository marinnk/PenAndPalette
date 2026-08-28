resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"
  # terraform destroy時にイメージが残っていてもリポジトリごと削除できるようにする
  force_delete = true

  tags = { Name = "${var.project_name}-backend" }
}
