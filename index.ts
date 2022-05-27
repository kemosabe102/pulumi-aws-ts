import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

import { readFileSync } from 'fs';
import { getFileHash, createCnameRecord } from "./util";

// Get the config ready to go.
const config = new pulumi.Config();

// Create VPN and Internet Gateway.
const _development = new aws.ec2.Vpc("development", {
    cidrBlock: "172.20.0.0/24",
    enableDnsHostnames: true,
});
const gw = new aws.ec2.InternetGateway("gw", {vpcId: _development.id});
const devSubnet = new aws.ec2.Subnet("devSubnet", {
    vpcId: _development.id,
    cidrBlock: "10.0.0.0/24",
    mapPublicIpOnLaunch: true,
}, {
    dependsOn: [gw],
});

// If keyName is provided, an existing KeyPair is used, else if publicKey is provided a new KeyPair
// derived from the publicKey is created.
let keyName: pulumi.Input<string> | undefined = config.get("keyName");
const publicKey = config.get("publicKey");

// The privateKey associated with the selected key must be provided (either directly or base64 encoded).
const privateKey = config.requireSecret("privateKey").apply(key => {
    if (key.startsWith("-----BEGIN RSA PRIVATE KEY-----")) {
        return key;
    } else {
        return Buffer.from(key, "base64").toString("ascii");
    }
});

// Get the id for the latest Amazon Linux AMI
const ami = aws.ec2.getAmi({
    filters: [
        { name: "name", values: ["amzn-ami-hvm-*-x86_64-ebs"] },
    ],
    owners: ["137112412989"], // Amazon
    mostRecent: true,
}).then(result => result.id);

// create a new security group for port 80 and 22
const anthonyPiP = "97.126.37.214/32"
const group = new aws.ec2.SecurityGroup("dev-env-secgrp", {
    ingress: [
        { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: [anthonyPiP], },
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"], },
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: [anthonyPiP], },
    ],
});

// startup script for the instance
const userData = readFileSync('_assets/scripts/code-server-setup.sh', 'utf-8');

// create a new instance then connect to it
const webDevServer = new aws.ec2.Instance("web-dev-server", {
    tags: { "Name": "web-dev-server" },
    instanceType: aws.ec2.InstanceType.T2_Micro, // t2.micro is available in the AWS free tier
    vpcSecurityGroupIds: [ group.id ], // reference the security group object above
    ami: ami,
    userData: userData,
    subnetId: devSubnet.id,
    keyName: keyName,
});
const connection: command.types.input.remote.ConnectionArgs = {
    host: webDevServer.publicIp,
    user: "ec2-user",
    privateKey,
};

// Create a new elastic IP
const eip = new aws.ec2.Eip("web-dev-server-eip", {
    vpc: true,
    instance: webDevServer.id,
    associateWithPrivateIp: "10.0.0.12",
}, {
    dependsOn: [gw],
});

const aRecord = createCnameRecord(config.targetDomain, eip);

const changeToken = getFileHash("_assets/caddyfile/Caddyfile");
// Copy a config file to our server.
const cpCaddyfileConfig = new command.remote.CopyFile("CaddyfileConfig", {
    triggers: [changeToken],
    connection,
    localPath: "_assets/caddyfile/Caddyfile",
    remotePath: "/etc/caddy/Caddyfile",
}, { dependsOn: webDevServer });

export const publicIp = webDevServer.publicIp;
export const publicHostName = webDevServer.publicDns;