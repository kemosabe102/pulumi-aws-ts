import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {ID, Lifted, Output, OutputInstance} from "@pulumi/pulumi";

// Create EC2 instance
export function createEc2Instance(
    instanceName: string,
    instanceType: string,
    ami: Promise<string>,
    subnetId: Output<ID>,
    securityGroupIds: (OutputInstance<string> & Lifted<string>)[],
    keyName: string | undefined,
    userData: string,
    tags: { [p: string]: string },
    dependsOn: pulumi.Resource[],
): aws.ec2.Instance {
    return new aws.ec2.Instance(instanceName, {
        tags: tags,
        instanceType: instanceType,
        ami: ami,
        subnetId: subnetId,
        vpcSecurityGroupIds: securityGroupIds,
        keyName: keyName,
        userData: userData,
        monitoring: true,
    }, {
        dependsOn: dependsOn,
    });
}