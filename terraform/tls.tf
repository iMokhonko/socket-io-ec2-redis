data "aws_route53_zone" "zone" {
  name         = "imokhonko.com"
  private_zone = false
}

# Create TLS certificate
resource "aws_acm_certificate" "chat_cirtificate" {
  domain_name       = "api.chat.imokhonko.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# create validation for TLS certificate in route 53
resource "aws_route53_record" "chat_route53_record" {
  for_each = {
    for dvo in aws_acm_certificate.chat_cirtificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.zone.zone_id
}

resource "aws_acm_certificate_validation" "validation" {
  certificate_arn         = aws_acm_certificate.chat_cirtificate.arn
  validation_record_fqdns = [for record in aws_route53_record.chat_route53_record : record.fqdn]
}
