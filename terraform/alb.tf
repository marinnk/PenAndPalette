resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]

  tags = { Name = "${var.project_name}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # Fargateのawsvpcネットワークモードでは"ip"が必須

  health_check {
    # backend/core/views.py の HealthCheckView（AllowAny・DB非依存）
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.project_name}-backend-tg" }
}

# 独自ドメイン・ACM証明書がないため443リスナーは作らず、80番のみ
# （CloudFrontエッジ〜ブラウザ間はHTTPSで保護される。CloudFront〜ALB間がHTTPになる
# トレードオフはdocs/infrastructure-design.md参照）
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
