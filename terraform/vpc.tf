# Create VPC
resource "aws_vpc" "chat_backend_vpc" {
  cidr_block           = "172.16.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "chat-backend-vpc"
  }
}

# Create Internet Gateway for VPC
resource "aws_internet_gateway" "chat_internet_gateway" {
  vpc_id = aws_vpc.chat_backend_vpc.id

  tags = {
    Name = "chat-backend-vpc-ig"
  }
}

# Allocate elastic IP
# resource "aws_eip" "chat_nat_gateway_eip" {
#   vpc = true
# }

# Create public subnet in first AZ
resource "aws_subnet" "chat_public_subnet_a" {
  vpc_id            = aws_vpc.chat_backend_vpc.id
  cidr_block        = "172.16.0.0/24"
  availability_zone = "eu-central-1a"

  tags = {
    Name = "chat-public-subnet-a"
  }
}

# Create public subnet in second AZ
resource "aws_subnet" "chat_public_subnet_b" {
  vpc_id            = aws_vpc.chat_backend_vpc.id
  cidr_block        = "172.16.1.0/24"
  availability_zone = "eu-central-1b"

  tags = {
    Name = "chat-public-subnet-b"
  }
}

# Create private subnet in first AZ
resource "aws_subnet" "chat_private_subnet_a" {
  vpc_id            = aws_vpc.chat_backend_vpc.id
  cidr_block        = "172.16.2.0/24"
  availability_zone = "eu-central-1a"

  tags = {
    Name = "chat-private-subnet-a"
  }
}

# Create private subnet in second AZ
resource "aws_subnet" "chat_private_subnet_b" {
  vpc_id            = aws_vpc.chat_backend_vpc.id
  cidr_block        = "172.16.3.0/24"
  availability_zone = "eu-central-1b"

  tags = {
    Name = "chat-private-subnet-b"
  }
}

# resource "aws_nat_gateway" "chat_nat_gateway" {
#   allocation_id = aws_eip.chat_nat_gateway_eip.id
#   subnet_id     = aws_subnet.chat_public_subnet_a.id

#   tags = {
#     Name = "chat-ng"
#   }

#   # To ensure proper ordering, it is recommended to add an explicit dependency
#   # on the Internet Gateway for the VPC.
#   depends_on = [aws_internet_gateway.chat_internet_gateway]
# }

# Create route table for public subnets
# It will route all non-local trafic to internet gateway
resource "aws_route_table" "chat_public_subnets_route_table" {
  vpc_id = aws_vpc.chat_backend_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.chat_internet_gateway.id
  }

  tags = {
    Name = "chat-backend-public-subnets-route-table"
  }
}

# Assosiate chat_public_subnets_route_table with public subnet A
resource "aws_route_table_association" "chat_public_subnet_a_route_table_assosiation" {
  subnet_id      = aws_subnet.chat_public_subnet_a.id
  route_table_id = aws_route_table.chat_public_subnets_route_table.id
}

# Assosiate chat_public_subnets_route_table with public subnet B
resource "aws_route_table_association" "chat_public_subnet_b_route_table_assosiation" {
  subnet_id      = aws_subnet.chat_public_subnet_b.id
  route_table_id = aws_route_table.chat_public_subnets_route_table.id
}

# Create route table for private subnets
resource "aws_route_table" "chat_private_subnets_route_table" {
  vpc_id = aws_vpc.chat_backend_vpc.id

  tags = {
    Name = "chat-backend-private-subnets-route-table"
  }
}

# Assosiate chat_private_subnets_route_table with private subnet B
resource "aws_route_table_association" "chat_private_subnet_a_route_table_assosiation" {
  subnet_id      = aws_subnet.chat_private_subnet_a.id
  route_table_id = aws_route_table.chat_private_subnets_route_table.id
}

# Assosiate chat_private_subnets_route_table with private subnet B
resource "aws_route_table_association" "chat_private_subnet_b_route_table_assosiation" {
  subnet_id      = aws_subnet.chat_private_subnet_b.id
  route_table_id = aws_route_table.chat_private_subnets_route_table.id
}
