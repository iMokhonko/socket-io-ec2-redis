# Create A record (alias) to Application Load Balancer
resource "aws_route53_record" "chat_record" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = "api.chat.imokhonko.com"
  type    = "A"

  alias {
    name                   = aws_lb.chat_alb.dns_name
    zone_id                = aws_lb.chat_alb.zone_id
    evaluate_target_health = true
  }
}
