# Create S3 Gateway VPC Endpoint in order to download image from ECR
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.chat_backend_vpc.id
  service_name = "com.amazonaws.eu-central-1.s3"

  route_table_ids = [aws_route_table.chat_private_subnets_route_table.id]
}

# Create DynamoDB Gateway VPC Endpoint
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.chat_backend_vpc.id
  service_name = "com.amazonaws.eu-central-1.dynamodb"

  route_table_ids = [aws_route_table.chat_private_subnets_route_table.id]
}

# ECR API endpoint
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.chat_backend_vpc.id
  service_name        = "com.amazonaws.eu-central-1.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [aws_security_group.chat_backend_vpc_endpoint_sg.id]
  subnet_ids         = [aws_subnet.chat_private_subnet_a.id, aws_subnet.chat_private_subnet_b.id]
}

# ECR DKR endpoint (for pulling images)
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.chat_backend_vpc.id
  service_name        = "com.amazonaws.eu-central-1.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true


  security_group_ids = [aws_security_group.chat_backend_vpc_endpoint_sg.id]
  subnet_ids         = [aws_subnet.chat_private_subnet_a.id, aws_subnet.chat_private_subnet_b.id]
}

# Create security group for VPC Endpoints
resource "aws_security_group" "chat_backend_vpc_endpoint_sg" {
  name        = "chat-backend-vpc-endpoint-sg"
  description = "Allow inbound traffic from EC2 instances security groups"
  vpc_id      = aws_vpc.chat_backend_vpc.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Attach inbound rule to vpc endpoint security group that allow inbound traffic from autoscaling ec2 instances group
# resource "aws_security_group_rule" "vpc_endpoint_to_alb_sg" {
#   type              = "ingress"
#   from_port         = 0
#   to_port           = 0
#   protocol          = "-1"
#   security_group_id = aws_security_group.chat_backend_vpc_endpoint_sg.id
#   source_security_group_id = aws_security_group.chat_asg_sg.id

#   lifecycle {
#     ignore_changes = [source_security_group_id]
#   }
# }
