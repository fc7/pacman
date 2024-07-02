// import http from 'http';
import https from 'https';
import express from "express";
const router = express.Router();
import fs from 'fs';
import os from 'os';
import axios from "axios";

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/metadata', async (req, res, next) => {

    // TODO make querying metadata providers optional by means of env variable
    const functionChain = [
        getK8sCloudMetadata,
        getAWSCloudMetadata,
        getAzureCloudMetadata,
        getGCPCloudMetadata,
        getOpenStackCloudMetadata,
        getFallbackMetadata,
    ];

    const cloudMetaData = await getCloudMetadata(functionChain);

    console.log(`cloudMetaData = ${cloudMetaData}`);

    res.json(cloudMetaData);
});

async function getCloudMetadata(functions) {
    for (const func of functions) {
        try {
            console.log(`Trying ${func.name} ...`)
            const result = await func();
            if (result) {
                console.log(`Function ${func.name} succeeded: ${result}`);
                return result;
            }
        } catch (error) {
            //console.error(`Error in function ${func.name}`);
        }
    }
}

const getOpenStackCloudMetadata = async () => {

    const instance = axios.create({
        baseUrl: "http://169.254.169.254",
        timeout: 10000
    });

    const openStackInfo = await instance.get('/openstack/latest/meta_data.json');
    const cloudName = 'OpenStack';
    if (openStackInfo.meta) {
        clusterId = openStackInfo.meta.clusterid;
        if (clusterId) {
            cloudName += ' - ' + clusterId.split('.')[0];
        }
    }

    return {
        cloud: cloudName,
        zone: openStackInfo.availability_zone || 'unknown'
    }
}

const getAWSCloudMetadata = async () => {

    const instance = axios.create({
        baseUrl: "http://169.254.169.254",
        timeout: 10000,
        responseType: 'text'
    });

    // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
    const apiToken = await instance.put('/latest/api/token', {
        headers: {
            'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        }
    });

    const zoneInfo = await instance.get('/latest/meta-data/placement/availability-zone', {
        headers: {
            'X-aws-ec2-metadata-token': apiToken
        }
    });
    const zone = zoneInfo.split('/').pop().toLowerCase();

    return {
        cloud: 'AWS',
        zone: zone,
    }
}

const getAzureCloudMetadata = async () => {
    const instance = axios.create({
        baseUrl: "http://169.254.169.254",
        headers: {
            'Metadata': 'true'
        },
        timeout: 10000,
        responseType: 'json'
    });

    const azureInfo = await instance.get('/metadata/instance?api-version=2021-02-01');

    const zone = azureInfo.compute.zone || 'unknown';

    return {
        cloud: 'Azure',
        zone: zone,
    }
}

const getGCPCloudMetadata = async () =>  {

    const instance = axios.create({
        baseUrl: "http://metadata.google.internal",
        headers: {
            'Metadata-Flavor': 'Google'
        },
        timeout: 10000,
        responseType: 'text'
    });

    const gcpZoneInfo = await instance.get('/computeMetadata/v1/instance/zone');

    const zone = gcpZoneInfo.split('/').pop().toLowerCase();

    return {
        cloud: 'GCP',
        zone: zone,
    }
}

const getK8sCloudMetadata = async () => {

    const cloudName = 'unknown',
        zoneName = 'unknown';

    const podName = os.hostname();
    if (!fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount')) {
        throw new Error("No service account detected. Probably not running in Kubernetes");
    }

    const sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    const ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    const instance = axios.create({
        httpsAgent: new https.Agent({ ca: ca_file }),
        headers: {
            'Authorization': `Bearer ${sa_token}`
        },
        baseUrl: "https://kubernetes.default.svc.cluster.local",
        timeout: 10000
    });

    const k8sNodesInfo = await instance.get('/api/v1/nodes');
    const k8snode = k8sNodesInfo.items[0];
    const nodeName = k8snode.metadata.name || 'unknown';
    if (nodeName == 'unknown' && k8snode.metadata.labels['kubernetes.io/hostname']) {
        nodeName = k8snode.metadata.labels['kubernetes.io/hostname'];
    }
    console.log(`On Kubernetes Node ${nodeName}`);

    if (k8snode.spec.providerID) {
        cloudName = k8snode.spec.providerID.split(":")[0];
    } else {
        console.log('Trying OpenShift API ...')
        try {
            const openShiftClusterInfo = await instance.get('/apis/config.openshift.io/v1/infrastructures/cluster');
            if (openShiftClusterInfo.spec.platformSpec.type) {
                cloudName = openShiftClusterInfo.spec.platformSpec.type
            }
        } catch (error) {
            console.error(error);
        }
    }
    console.log(`Found providerID ${cloudName}`);

    if (k8snode.metadata.labels['topology.kubernetes.io/zone']) {
        // https://kubernetes.io/docs/reference/labels-annotations-taints/#topologykubernetesiozone
        zoneName = k8snode.metadata.labels['topology.kubernetes.io/zone']
    } // only set by OVN
    else if (k8snode.metadata.annotations['k8s.ovn.org/zone-name']) {
        zoneName = k8snode.metadata.annotations['k8s.ovn.org/zone-name'];
    }
    else if (k8snode.metadata.labels['failure-domain.beta.kubernetes.io/zone']) {
        // https://kubernetes.io/docs/reference/labels-annotations-taints/#failure-domainbetakubernetesiozone DEPRECATED
        zoneName = k8snode.metadata.labels['failure-domain.beta.kubernetes.io/zone']
    }
    console.log(`Found Zone ${zoneName}`);

    return {
        host: nodeName,
        cloud: cloudName,
        zone: zoneName,
        pod: podName
    }

}

const getFallbackMetadata = async () => {
    return {
        host: os.hostname(),
        cloud: 'on-prem',
        zone: 'unknown'
    }
}

export default router
