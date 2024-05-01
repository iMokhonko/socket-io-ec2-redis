# Create target group for ALB
resource "aws_lb_target_group" "chat_lb_target_group" {
  name                 = "chat-lb-tg"
  port                 = 80
  deregistration_delay = 5
  protocol             = "HTTP"
  vpc_id               = aws_vpc.chat_backend_vpc.id

  stickiness {
    type = "lb_cookie"
  }

  health_check {
    port     = 3000
    path     = "/health"
    interval = 10
  }
}

# Create ALB security group
resource "aws_security_group" "chat_alb_sg" {
  name        = "chat-alb-sg"
  description = "Allow TCP traffic to ALB"
  vpc_id      = aws_vpc.chat_backend_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Create ALB
resource "aws_lb" "chat_alb" {
  name               = "chat-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.chat_alb_sg.id]
  subnets            = [aws_subnet.chat_public_subnet_a.id, aws_subnet.chat_public_subnet_b.id]
}

# Create ALB HTTP listener
resource "aws_lb_listener" "chat_alb_http_listener" {
  load_balancer_arn = aws_lb.chat_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Create ALB HTTPS listener
resource "aws_lb_listener" "chat_alb_https_listener" {
  load_balancer_arn = aws_lb.chat_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate.chat_cirtificate.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.chat_lb_target_group.arn
  }
}
