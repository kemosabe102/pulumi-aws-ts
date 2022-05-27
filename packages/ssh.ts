import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create new RSA key pair
export function createKeyPair(name: string, publicKey: string): aws.ec2.KeyPair {
    return new aws.ec2.KeyPair(name, {
        publicKey: publicKey,
        keyName: name,
    });
}