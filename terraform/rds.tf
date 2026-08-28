resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-db-subnet-group" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "mysql"
  engine_version = "8.4"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # MySQL 8 は文字セットの既定が utf8mb4 のため、追加のパラメータグループは不要
  # （backend/config/settings.py も OPTIONS で charset=utf8mb4 を指定している）

  multi_az            = false
  publicly_accessible = false

  # 検証後にdestroyする運用のため、最終スナップショット・バックアップ・削除保護は不要
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 0

  auto_minor_version_upgrade = true

  tags = { Name = "${var.project_name}-db" }
}
