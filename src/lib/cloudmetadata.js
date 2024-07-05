
import fs from 'fs';
import https from 'https';
import os from 'os';
import axios from "axios";

axios.defaults.timeout = 2000;

export class CloudMetadata {

    static getOpenStackCloudMetadata = async () => {

        const response = await axios.get('http://169.254.169.254/openstack/latest/meta_data.json', {
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
    
    static getAWSCloudMetadata = async () => {
    
        // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
        const tokenResponse = await axios.put('http://169.254.169.254/latest/api/token', {
            headers: {
                'X-aws-ec2-metadata-token-ttl-seconds': '21600'
            },
            responseType: 'text'
        });
    
        const zoneResponse = await axios.get('http://169.254.169.254/latest/api/token/latest/meta-data/placement/availability-zone', {
            headers: {
                'X-aws-ec2-metadata-token': tokenResponse.data
            },
            responseType: 'text'
        });
        const zone = zoneResponse.data.split('/').pop().toLowerCase();
    
        return {
            cloud: 'AWS',
            zone: zone,
        }
    }
    
    static getAzureCloudMetadata = async () => {
       
        const azureResponse = await axios.get('http://169.254.169.254/metadata/instance?api-version=2021-02-01', {
            headers: {
                'Metadata': 'true'
            },
            responseType: 'json'
        });
    
        const zone = azureResponse.data.compute.zone || 'Unknown';
    
        return {
            cloud: 'Azure',
            zone: zone,
        }
    }
    
    static getGCPCloudMetadata = async () =>  {
    
        const gcpZoneResponse = await axios.get('http://metadata.google.internal/computeMetadata/v1/instance/zone', {
            headers: {
                'Metadata-Flavor': 'Google'
            },
            responseType: 'text'
        });
    
        const zone = gcpZoneResponse.data.split('/').pop().toLowerCase();
    
        return {
            cloud: 'GCP',
            zone: zone,
        }
    }
    
    static getK8sCloudMetadata = async () => {
    
        let cloudName = 'On-prem',
            zoneName = 'Unknown';
    
        if (!fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount')) {
            const msg = "No service account detected. Probably not running in Kubernetes";
            throw new Error(msg);
        }
    
        const sa_token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');
        const ca_file = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
        const instance = axios.create({
            httpsAgent: new https.Agent({ ca: ca_file }),
            headers: {
                'Authorization': `Bearer ${sa_token}`
            }
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
    
    static getFallbackMetadata = async () => {
        return {
            host: os.hostname(),
            cloud: 'On-prem',
            zone: 'Unknown'
        }
    }
}