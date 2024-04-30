data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_ecr_repository" "ecr_repository" {
  name                 = "chat-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "null_resource" "build_and_push_docker_image" {
  triggers = {
    always_run = timestamp()

    # This re-triggers this resource whenever the ECR repo changes
    ecr_repo = aws_ecr_repository.ecr_repository.repository_url
  }

  provisioner "local-exec" {
    command = <<EOF
    $(aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com)

    docker build -t chat-backend ../
    docker tag chat-backend:latest ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/chat-backend:latest
    docker push ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/chat-backend:latest
    EOF
  }

  depends_on = [aws_ecr_repository.ecr_repository]
}
