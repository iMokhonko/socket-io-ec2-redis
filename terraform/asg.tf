# # Create ASG security group
resource "aws_security_group" "chat_asg_sg" {
  name        = "chat-asg-sg"
  description = "Allow HTTP traffic from ALB"
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

# Attach outbound rule for ec2 instances that allow outbound traffic from ec2 to anywhere 
# resource "aws_security_group_rule" "alb_asg_to_vpc_endpoint" {
#   type              = "egress"
#   from_port         = 0
#   to_port           = 0
#   protocol          = "-1"
#   security_group_id = aws_security_group.chat_asg_sg.id
#   source_security_group_id = aws_security_group.chat_backend_vpc_endpoint_sg.id
# }

# Create IAM role for EC2 instances
resource "aws_iam_role" "ec2_iam_role" {
  name = "ec2_chat_backend_role"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "sts:AssumeRole"
        ],
        "Principal" : {
          "Service" : [
            "ec2.amazonaws.com"
          ]
        }
      }
    ]
  })
}

# Attach ECR Readonly Access in order to be able access API & pull images
resource "aws_iam_role_policy_attachment" "ecr_read_only_role" {
  role       = aws_iam_role.ec2_iam_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Attach S3 Readonly Acccess in roder to allow to pull actual image data from S3
resource "aws_iam_role_policy_attachment" "s3_read_only_role" {
  role       = aws_iam_role.ec2_iam_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

# Attach Elasticache full access
resource "aws_iam_role_policy_attachment" "elasticache_full_access_role" {
  role       = aws_iam_role.ec2_iam_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess"
}

# Attach DynamoDB full access
resource "aws_iam_role_policy_attachment" "dynamodb_full_access_role" {
  role       = aws_iam_role.ec2_iam_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_instance_profile" "chat_ec2_instances_profile" {
  name = "chat-ws-ec2-instances-profile"
  role = aws_iam_role.ec2_iam_role.name
}

# Create launch template for autoscaling group
resource "aws_launch_template" "chat_asg_launch_template" {
  update_default_version = true
  name_prefix            = "chat-chat-backend-launch-template-"

  // Primary instance type
  instance_type = "t4g.micro"

  # key_name = "ec2_instance"

  image_id               = "ami-06ea60c08bdaa1f49"
  user_data              = filebase64("./user-data.sh")
  vpc_security_group_ids = [aws_security_group.chat_asg_sg.id]

  iam_instance_profile {
    name = "chat-ws-ec2-instances-profile"
  }

  // should waint untill first image will be pushed to ecr repository
  depends_on = [null_resource.build_and_push_docker_image]
}

resource "aws_autoscaling_group" "chat_asg" {
  name                    = "chat-chat-backend-asg"
  desired_capacity        = 2
  max_size                = 3
  min_size                = 2
  default_instance_warmup = 15

  target_group_arns = [aws_lb_target_group.chat_lb_target_group.arn]

  vpc_zone_identifier = [
    aws_subnet.chat_private_subnet_a.id,
    aws_subnet.chat_private_subnet_b.id
  ]

  mixed_instances_policy {
    instances_distribution {
      # number of on-demand instances that will be always launched before spot instances
      on_demand_base_capacity = 1

      # percent of on-demand instances that should be launched after on-demand base capacity is reached 
      # 0 it mens it will always launch spot instancess
      # 25 it means 25% percent of instances will be on-demand
      on_demand_percentage_above_base_capacity = 0

      # this one is recomended
      spot_allocation_strategy = "price-capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.chat_asg_launch_template.id
        version            = "$Latest"
      }

      override {
        instance_type     = "t4g.micro" #t4g becuase this is cheapes version and support arm64 Docker images
        weighted_capacity = "1"
      }

      override {
        instance_type     = "t4g.small" #t4g becuase this is cheapes version and support arm64 Docker images
        weighted_capacity = "1"
      }
    }
  }

  capacity_rebalance = true
}

# Create scaling policy
resource "aws_autoscaling_policy" "bat" {
  name                   = "CPU_tracking"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.chat_asg.name


  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }

    target_value = 70.0
  }
}

# Executes instance refresh
# TODO prevent for first launch
# TODO move to separate flow as this is not resource "set-up"-based action
resource "null_resource" "start_instance_refresh" {
  provisioner "local-exec" {
    command = "aws autoscaling start-instance-refresh --auto-scaling-group-name ${aws_autoscaling_group.chat_asg.name} --strategy Rolling --preferences '{\"MinHealthyPercentage\": 50, \"InstanceWarmup\": 10}'"
  }
  triggers = {
    always_run = timestamp()
  }
}
