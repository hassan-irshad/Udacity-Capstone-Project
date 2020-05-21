import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import * as uuid from 'uuid'

import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda'

const XAWS = AWSXRay.captureAWS(AWS)

import { saveImageUrl, catalogueExist } from '../../businessLogic/catalogue'

const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = process.env.SIGNED_URL_EXPIRATION

const s3 = new XAWS.S3({
    signatureVersion: 'v4'
})

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const catalogueId = event.pathParameters.catalogueId
    const jwtToken = event.headers.Authorization.split(' ')[1]

    const validCatalogueId = await catalogueExist(catalogueId, jwtToken)

    if (!validCatalogueId) {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Catalogue does not exist'
            })
        }
    }

    const imageId = uuid.v4()
    const url = getUploadUrl(imageId)

   await saveImageUrl(catalogueId, imageId, jwtToken)

    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            uploadUrl: url
        })
    }
}

function getUploadUrl(imageId: string) {
    return s3.getSignedUrl('putObject', {
        Bucket: bucketName,
        Key: imageId,
        Expires: Number(urlExpiration)
    })
}