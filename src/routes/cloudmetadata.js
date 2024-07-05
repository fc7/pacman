import express from "express";
const router = express.Router();
import { CloudMetadata } from '../lib/cloudmetadata.js';

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/metadata', async (req, res, next) => {

    const functionChain = [
        CloudMetadata.getK8sCloudMetadata,
        CloudMetadata.getAWSCloudMetadata,
        CloudMetadata.getAzureCloudMetadata,
        CloudMetadata.getGCPCloudMetadata,
        CloudMetadata.getOpenStackCloudMetadata,
        CloudMetadata.getFallbackMetadata,
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

export default router
