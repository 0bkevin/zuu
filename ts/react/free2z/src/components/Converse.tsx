import { useParams } from "react-router-dom";
import { CommentData } from "./DisplayThreadedComments";
import { lazy, useEffect, useState } from "react";
import axios from "axios";
import { Grid } from "@mui/material";
import DisplayThreadedComment from "./DisplayThreadedComment";
import LoadingBackdrop from "./LoadingBackdrop";

const Global404 = lazy(() => import('../Global404'))

export default function Converse() {
    const params = useParams();
    const parent = params.commentUUID;
    const [loading, setLoading] = useState(true);

    const [comment, setComment] = useState<CommentData | null>(null);

    useEffect(() => {
        axios.get(`/api/comments/${parent}/`).then(res => {
            setComment(res.data)
        }).catch(() => {
            // prevent error when comment is not found
        }).finally(() => {
            setLoading(false);
        })
    }, [parent])

    if (loading) return <LoadingBackdrop />
    if (!comment || !comment.uuid) return(
        <div style={{
            // use the entire screen
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        }}>
             <Global404 />
        </div>
    )

    return (
        <Grid
            textAlign="left"
            alignItems="center"
            justifyContent="center"
            width="100%"
            style={{
                overflowWrap: "break-word",
                overflowX: "auto",
                padding: "0.33em",
            }}
        >
            <DisplayThreadedComment
                comment={comment}
                top={true}
            />
        </Grid>
    )
}