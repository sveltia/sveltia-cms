import { S3CompatibleService } from './service';

/**
 * Amazon S3 media library service integration.
 */
const awsS3 = new S3CompatibleService({
  serviceId: 'aws_s3',
  serviceLabel: 'Amazon S3',
  serviceURL: 'https://aws.amazon.com/s3/',
  developerURL: 'https://docs.aws.amazon.com/s3/',
  apiKeyURL: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40}$/,
});

export default awsS3;
