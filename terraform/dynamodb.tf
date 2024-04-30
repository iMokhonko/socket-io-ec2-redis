# Create table for storing data
module "dynamodb_table" {
  source = "terraform-aws-modules/dynamodb-table/aws"

  name                        = "chat-table"
  hash_key                    = "PK"
  range_key                   = "SK"
  table_class                 = "STANDARD"
  deletion_protection_enabled = false
  stream_enabled              = true
  stream_view_type            = "NEW_AND_OLD_IMAGES"

  attributes = [
    {
      name = "PK"
      type = "S"
    },
    {
      name = "SK"
      type = "S"
    }
  ]
}
