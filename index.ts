import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from '@pulumi/command';
import * as tls from '@pulumi/tls';

import {readFileSync} from 'fs';
import {createARecord, getFileHash} from "./util";
import {createEc2Instance} from './packages/ec2';

// Get the config ready to go.
const config = new pulumi.Config();

// Load the config values.
const vpcName = config.require("vpcNameDev");
const vpcCidr = config.require("vpcCidrBlock");
const internetGatewayName = config.require("internetGatewayName");
const devSubnetName = config.require("devSubnetName");
const subnetCidrBlock = config.require("subnetCidrBlock");
const anthonyPip = config.require("anthonyPip");
const secGrpNameDev = config.require("secGrpNameDev");
const keyName = config.require("keyName");
const pathToSetupScript = config.require("pathToSetupScript");
const webDev01ServerName = config.require("webDev01ServerName");
const webDev01ServerElasticIpName = config.require("webDev01ServerElasticIpName");
const pathToCaddyfile = config.require("pathToCaddyfile");
const targetDomain = config.require("targetDomain");


// Create VPN and Internet Gateway.
const _development = new aws.ec2.Vpc(vpcName, {
    cidrBlock: vpcCidr,
    enableDnsHostnames: true,
});
const gw = new aws.ec2.InternetGateway(internetGatewayName, {vpcId: _development.id});

// Create subnet for dev environments
const devSubnet = new aws.ec2.Subnet(devSubnetName, {
    vpcId: _development.id,
    cidrBlock: subnetCidrBlock,
    mapPublicIpOnLaunch: true,
}, {
    dependsOn: [gw],
});

// Create a new security group for port 80, 443, and 22
const group = new aws.ec2.SecurityGroup(secGrpNameDev, {
    ingress: [
        {protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: [anthonyPip],},
        {protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"],},
        {protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: [anthonyPip],},
    ],
});

// Create SSH key pair
// Amazon EC2 supports ED25519 and 2048-bit SSH-2 RSA keys for Linux instances.
const sshKey = new tls.PrivateKey(keyName, { algorithm: "ED25519" });

// startup script for the instance
const userData = readFileSync(pathToSetupScript, 'utf-8');

// Get the id for the latest Amazon Linux AMI
const ami = aws.ec2.getAmi({
    filters: [
        {name: "name", values: ["amzn2-ami-hvm-x86_64-gp2"]},
    ],
    owners: ["137112412989"], // Amazon
    mostRecent: true,
}).then(ami => ami.id);

// create a new instance
const webDevServer = createEc2Instance(
    webDev01ServerName,
    "t2.micro",
    ami,
    devSubnet.id,
    [group.id],
    keyName,
    userData,
    {"Name": webDev01ServerName},
    [devSubnet]);

// Create a new elastic IP
const eip = new aws.ec2.Eip(webDev01ServerElasticIpName, {
    instance: webDevServer.id,
    vpc: true,
}, {
    dependsOn: [gw, webDevServer],
});

// Connect to instance
const connection: command.types.input.remote.ConnectionArgs = {
    host: eip.publicIp,
    user: "ec2-user",
    privateKey: sshKey.privateKeyOpenssh,
};

// Create Route 53 record for the new EC2 instance
const aRecord = createARecord(targetDomain, eip);

// Copy a config file to our server.
const changeToken = getFileHash(pathToCaddyfile);
new command.remote.CopyFile("CaddyfileConfig", {
    triggers: [changeToken],
    connection,
    localPath: pathToCaddyfile,
    remotePath: "/etc/caddy/Caddyfile.dev01",
}, {dependsOn: webDevServer});

export const publicIp = webDevServer.publicIp;
export const publicHostName = webDevServer.publicDns;
export const dnsName = aRecord.name;