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

    const functionChain = [
        getK8sCloudMetadata,
        getAWSCloudMetadata,
        getAzureCloudMetadata,
        getGCPCloudMetadata,
        getOpenStackCloudMetadata,
        getFallbackMetadata,
    ];

    const cloudMetaData = await getCloudMetadata(functionChain);

    console.log('cloudMetaData = ', cloudMetaData);

    res.json(cloudMetaData);
});

async function getCloudMetadata(functions) {
    for (const func of functions) {
        try {
            console.log(`Trying ${func.name} ...`)
            const result = await func();
            if (result) {
                console.log(`Function ${func.name} succeeded`);
                return result;
            }
        } catch (error) {
            console.error(`Error in function ${func.name}: ${error.message}`);
        }
    }
}

const getOpenStackCloudMetadata = async () => {

    const response = await axios.get('http://169.254.169.254/openstack/latest/meta_data.json', {
        timeout: 5000,
        responseType: 'json'
    });
    const cloudName = 'OpenStack';
    if (response.data.meta) {
        clusterId = response.data.meta.clusterid;
        if (clusterId) {
            cloudName += ' - ' + clusterId.split('.')[0];
        }
    }

    return {
        cloud: cloudName,
        zone: response.data.availability_zone || 'Unknown'
    }
}

const getAWSCloudMetadata = async () => {

    // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
    const tokenResponse = await axios.put('http://169.254.169.254/latest/api/token', {
        headers: {
            'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        },
        responseType: 'text',
        timeout: 5000
    });

    const zoneResponse = await axios.get('http://169.254.169.254/latest/api/token/latest/meta-data/placement/availability-zone', {
        headers: {
            'X-aws-ec2-metadata-token': tokenResponse.data
        },
        responseType: 'text',
        timeout: 5000
    });
    const zone = zoneResponse.data.split('/').pop().toLowerCase();

    return {
        cloud: 'AWS',
        zone: zone,
    }
}

const getAzureCloudMetadata = async () => {
   
    const azureResponse = await axios.get('http://169.254.169.254/metadata/instance?api-version=2021-02-01', {
        headers: {
            'Metadata': 'true'
        },
        timeout: 5000,
        responseType: 'json'
    });

    const zone = azureResponse.data.compute.zone || 'Unknown';

    return {
        cloud: 'Azure',
        zone: zone,
    }
}

const getGCPCloudMetadata = async () =>  {

    const gcpZoneResponse = await axios.get('http://metadata.google.internal/computeMetadata/v1/instance/zone', {
        headers: {
            'Metadata-Flavor': 'Google'
        },
        timeout: 5000,
        responseType: 'text'
    });

    const zone = gcpZoneResponse.data.split('/').pop().toLowerCase();

    return {
        cloud: 'GCP',
        zone: zone,
    }
}

const getK8sCloudMetadata = async () => {

    let cloudName = 'On-prem',
        zoneName = 'Unknown';

    if (!fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount')) {
        const msg = "No service account detected. Probably not running in Kubernetes";
        console.error(msg);
        throw new Error(msg);
    }

    const sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
    const ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
    const instance = axios.create({
        httpsAgent: new https.Agent({ ca: ca_file }),
        headers: {
            'Authorization': `Bearer ${sa_token}`
        },
        timeout: 5000
    });

    const k8sResponse = await instance.get('https://kubernetes.default.svc.cluster.local/api/v1/nodes');
    const k8snode = k8sResponse.data.items[0];
    console.debug(`Node info = ${JSON.stringify(k8snode)}`);
    const nodeName = k8snode.metadata.name || 'Unknown';
    if (nodeName == 'Unknown' && k8snode.metadata.labels['kubernetes.io/hostname']) {
        nodeName = k8snode.metadata.labels['kubernetes.io/hostname'];
    }
    console.log(`On Kubernetes Node ${nodeName}`);

    if (k8snode.spec.providerID) {
        cloudName = k8snode.spec.providerID.split(":")[0];
        console.log(`Found providerID ${cloudName}`);
    } else {
        console.log('Trying OpenShift API ...')
        try {
            const openshiftClusterResponse = await instance.get('https://kubernetes.default.svc.cluster.local/apis/config.openshift.io/v1/infrastructures/cluster');
            console.debug(`OpenShift Cluster Info = ${JSON.stringify(openshiftClusterResponse.data)}`);
            if (openshiftClusterResponse.data.spec.platformSpec.type && openshiftClusterResponse.data.spec.platformSpec.type != 'None') {
                cloudName = openshiftClusterResponse.data.spec.platformSpec.type;
                console.log(`Found platform type: ${cloudName}`);
            }
        } catch (error) {
            // console.error(error);
        }
    }

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
        host: os.hostname(),
        cloud: cloudName,
        zone: zoneName,
        node: nodeName
    }

}

const getFallbackMetadata = async () => {
    return {
        host: os.hostname(),
        cloud: 'On-prem',
        zone: 'Unknown'
    }
}

export default router
